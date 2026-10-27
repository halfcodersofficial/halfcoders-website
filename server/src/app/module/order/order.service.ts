import status from "http-status";
import { Prisma } from "../../../generated/prisma/client";
import {
    CourseStatus,
    EnrollmentStatus,
    NotificationType,
    OrderStatus,
    PaymentGateway,
} from "../../../generated/prisma/enums";
import { envVars } from "../../config/env";
import AppError from "../../errorHelpers/AppError";
import { IQueryParams } from "../../interfaces/query.interface";
import { IRequestUser } from "../../interfaces/requestUser.interface";
import { prisma } from "../../lib/prisma";
import { assertTransactionUnused, bkashGatewayData, BkashSubmission } from "../../utils/bkash";
import { sendEmailAsync } from "../../utils/email";
import { assertEnrollmentOpen, ENROLLMENT_RULE_SELECT } from "../../utils/courseBatch";
import { buildInvoicePdf, InvoicePdfData } from "../../utils/invoicePdf";
import { logger } from "../../utils/logger";
import { adminCourseSelect, AdminCourseCard } from "../../utils/adminCourseSelect";
import { QueryBuilder } from "../../utils/QueryBuilder";
import { nextOrderNumber, withUniqueRetry } from "../../utils/referenceNumber";
import { activateEnrollment } from "../enrollment/enrollment.service";
import { createNotification, notifyAdmins } from "../notification/notification.service";
import { collectAll, toCsv } from "../../utils/csvExport";
import { announceGrants, grantOfferCourses, revokeOfferGrants } from "../../utils/courseGrants";
import { lockCoupon, priceOrder, resolveCoupon } from "../coupon/coupon.service";

type InvoiceOrder = {
    id: string;
    orderNumber: string;
    createdAt: Date;
    amount: number;
    discount: number;
    couponCode: string | null;
    total: number;
    currency: string;
    course: { title: string };
    student: { name: string; email: string; phone: string | null };
    payment: { gateway: string; transactionId: string | null; paidAt: Date | null } | null;
};

const toInvoiceData = (order: InvoiceOrder): InvoicePdfData => ({
    orderNumber: order.orderNumber,
    issuedAt: order.payment?.paidAt ?? order.createdAt,
    studentName: order.student.name,
    studentEmail: order.student.email,
    studentPhone: order.student.phone,
    courseName: order.course.title,
    amount: order.amount,
    discount: order.discount,
    couponCode: order.couponCode,
    total: order.total,
    currency: order.currency,
    gateway: order.payment?.gateway ?? "FREE",
    transactionId: order.payment?.transactionId ?? null,
    paidAt: order.payment?.paidAt ?? null,
});

/**
 * Fire-and-forget: a slow or failed mailer must not hold up (or fail) the
 * request that just confirmed payment. Renders the PDF first so a render
 * error is at least visible in the logs `sendEmailAsync` writes to.
 */
const sendInvoiceEmail = (order: InvoiceOrder) => {
    void buildInvoicePdf(toInvoiceData(order))
        .then((pdf) =>
            sendEmailAsync(
                {
                    to: order.student.email,
                    subject: `Your Half Coders invoice — ${order.orderNumber}`,
                    templateName: "notification",
                    templateData: {
                        title: "Payment received",
                        message: `Thanks for enrolling in "${order.course.title}"! Your invoice is attached for your records.`,
                        actionUrl: `${envVars.FRONTEND_URL}/checkout/${order.id}`,
                        actionLabel: "View order",
                    },
                    attachments: [{ filename: `Invoice-${order.orderNumber}.pdf`, content: pdf }],
                },
                "order invoice email",
            ),
        )
        .catch((err) => logger.error("Failed to build invoice PDF for email", err));
};

const orderInclude = {
    course: { select: { id: true, title: true, slug: true, thumbnail: true, price: true } },
    student: { select: { id: true, name: true, email: true, phone: true } },
    payment: true,
} as const;

/**
 * Starts a checkout (plan §33). Creates a PENDING order that a payment gateway
 * will later settle — no enrolment is created here, so an unpaid order grants
 * no access.
 *
 * Free courses are the one exception: there is nothing to collect, so the
 * order is marked PAID and the enrolment is created immediately.
 */
/** The admin payments screen for this order's course, searched to the order and with it open. */
const adminOrderLink = (order: { id: string; courseId: string; orderNumber: string }) =>
    `/admin/orders/${order.courseId}?q=${encodeURIComponent(order.orderNumber)}&open=${order.id}`;

const createOrder = async (user: IRequestUser, input: { courseId: string }) => {
    const course = await prisma.course.findFirst({
        where: { id: input.courseId, isDeleted: false },
        select: { id: true, title: true, slug: true, price: true, discountPrice: true, ...ENROLLMENT_RULE_SELECT },
    });

    if (!course) throw new AppError(status.NOT_FOUND, "Course not found.");
    if (course.status !== CourseStatus.PUBLISHED) {
        throw new AppError(status.BAD_REQUEST, "This course is not available for purchase yet.");
    }

    const alreadyEnrolled = await prisma.enrollment.findUnique({
        where: { studentId_courseId: { studentId: user.userId, courseId: course.id } },
        select: { status: true },
    });
    if (
        alreadyEnrolled &&
        alreadyEnrolled.status !== EnrollmentStatus.CANCELLED &&
        alreadyEnrolled.status !== EnrollmentStatus.EXPIRED
    ) {
        throw new AppError(status.CONFLICT, "You are already enrolled in this course.");
    }

    // A bootcamp takes enrolments only inside a batch's enrolment window.
    // Admins can still enrol a student by hand.
    assertEnrollmentOpen(course);

    // Reuse an outstanding order instead of stacking up duplicates every time
    // the student clicks "Buy Now". (A bundle's orders are never pending, but
    // they aren't this course's checkout either way.)
    const pending = await prisma.order.findFirst({
        where: { studentId: user.userId, courseId: course.id, status: OrderStatus.PENDING, bundleOrderId: null },
        include: orderInclude,
    });
    if (pending) return repricePending(pending);

    // The price is read from the course here, never from the request — a
    // client-supplied amount would let a student buy a course for ৳1.
    const { amount, discount, total } = priceOrder(course, null);

    logger.create("Creating order", { courseId: course.id, studentId: user.userId, total });

    const order = await withUniqueRetry(async () => {
        const orderNumber = await nextOrderNumber();
        return prisma.order.create({
            data: {
                orderNumber,
                studentId: user.userId,
                courseId: course.id,
                amount,
                discount,
                total,
                status: total === 0 ? OrderStatus.PAID : OrderStatus.PENDING,
            },
            include: orderInclude,
        });
    });

    if (total === 0) return settleFreeOrder(order, course);
    return order;
};

/**
 * An order with nothing to pay — a free course, or a coupon that covers the
 * lot: marked paid with a FREE payment, the enrolment opened, the student
 * told (with the receipt by email) and the admins too.
 */
const settleFreeOrder = async (
    order: {
        id: string;
        orderNumber: string;
        courseId: string;
        studentId: string;
        bundleOrderId: string | null;
        student: { name: string };
    },
    course: { title: string; slug: string },
) => {
    const given = await prisma.$transaction(async (tx) => {
        await tx.order.update({ where: { id: order.id }, data: { status: OrderStatus.PAID } });
        await tx.payment.upsert({
            where: { orderId: order.id },
            create: { orderId: order.id, gateway: PaymentGateway.FREE, amount: 0, status: OrderStatus.PAID, paidAt: new Date() },
            update: { gateway: PaymentGateway.FREE, amount: 0, status: OrderStatus.PAID, paidAt: new Date() },
        });
        await activateEnrollment(tx, { studentId: order.studentId, courseId: order.courseId, orderId: order.id });
        // A paid course a coupon covered still counts as bought.
        return grantOfferCourses(tx, order);
    });

    await createNotification({
        userId: order.studentId,
        title: "You're enrolled!",
        message: `You now have access to "${course.title}". Start learning any time.`,
        type: NotificationType.COURSE,
        link: `/learn/${course.slug}`,
    });
    await announceGrants(order.studentId, given, `They came free with "${course.title}".`);

    await notifyAdmins({
        title: "New free enrolment",
        message: `${order.student.name} enrolled in "${course.title}" (${order.orderNumber}).`,
        type: NotificationType.COURSE,
        link: adminOrderLink(order),
    });

    const finalOrder = await prisma.order.findUniqueOrThrow({ where: { id: order.id }, include: orderInclude });
    sendInvoiceEmail(finalOrder);
    return finalOrder;
};

type CheckoutOrder = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;

/**
 * Re-prices an unpaid course order from the course as it is now, so checkout
 * always charges the latest price: a course made free or paid, or re-priced,
 * after the order was placed. A coupon that no longer applies comes off, and
 * an order the new price makes free is settled there and then. Nothing to do
 * for a paid order, or a bundle's share of one.
 */
const repricePending = async (order: CheckoutOrder): Promise<CheckoutOrder> => {
    if (order.status !== OrderStatus.PENDING || order.bundleOrderId) return order;

    const course = await prisma.course.findUniqueOrThrow({
        where: { id: order.courseId },
        select: { id: true, title: true, slug: true, price: true, discountPrice: true },
    });
    const coupon = order.couponCode
        ? await resolveCoupon(prisma, order.couponCode, course, order.studentId, order.id).catch(() => null)
        : null;
    const pricing = priceOrder(course, coupon);
    if (
        pricing.amount === order.amount &&
        pricing.discount === order.discount &&
        pricing.total === order.total &&
        pricing.couponCode === order.couponCode &&
        pricing.couponDiscount === order.couponDiscount
    ) {
        return order;
    }

    logger.update("Order re-priced", { orderId: order.id, from: order.total, to: pricing.total, couponCode: pricing.couponCode });
    const updated = await prisma.order.update({
        where: { id: order.id },
        data: {
            amount: pricing.amount,
            discount: pricing.discount,
            total: pricing.total,
            couponCode: pricing.couponCode,
            couponDiscount: pricing.couponDiscount,
            // A code that came off holds nothing any more.
            ...(pricing.couponCode ? {} : { couponAppliedAt: null }),
        },
        include: orderInclude,
    });
    return pricing.total === 0 ? settleFreeOrder(updated, course) : updated;
};

/**
 * Puts a coupon on the student's own unpaid order — or takes it off (`code`
 * null) — and re-prices it from the course as it stands now. A code that
 * covers the whole price settles the order there and then.
 *
 * The check and the write are one transaction holding the code's row lock,
 * so a limited code is never handed out twice for its last use: the order
 * carries the code from that moment, holding the use while the student pays.
 */
const setOrderCoupon = async (user: IRequestUser, orderId: string, code: string | null) => {
    const order = await prisma.order.findFirst({
        where: { id: orderId, studentId: user.userId },
        include: { ...orderInclude, course: { select: { ...orderInclude.course.select, discountPrice: true } } },
    });
    if (!order) throw new AppError(status.NOT_FOUND, "Order not found.");
    if (order.status !== OrderStatus.PENDING) throw new AppError(status.CONFLICT, "This order isn't waiting for payment any more.");
    if (order.bundleOrderId) throw new AppError(status.BAD_REQUEST, "A code can't go on a bundle's course.");

    const { updated, pricing } = await prisma.$transaction(async (tx) => {
        let coupon = null;
        if (code) {
            await lockCoupon(tx, code);
            coupon = await resolveCoupon(tx, code, order.course, user.userId, order.id);
        }
        const pricing = priceOrder(order.course, coupon);
        const updated = await tx.order.update({
            where: { id: orderId },
            data: {
                amount: pricing.amount,
                discount: pricing.discount,
                total: pricing.total,
                couponCode: pricing.couponCode,
                couponDiscount: pricing.couponDiscount,
                couponAppliedAt: coupon ? new Date() : null,
            },
            include: orderInclude,
        });
        return { updated, pricing };
    });
    logger.update(code ? "Coupon applied" : "Coupon removed", { orderId, couponCode: pricing.couponCode, total: pricing.total });

    if (pricing.total === 0) return withCoupon(await settleFreeOrder(updated, order.course));
    return withCoupon(updated);
};

/**
 * The order with its coupon's public face beside the code — the label the
 * student was told about ("Eden Mohila College programme") — for checkout.
 */
const withCoupon = async <T extends { couponCode: string | null }>(order: T) => ({
    ...order,
    coupon: order.couponCode
        ? await prisma.coupon.findUnique({ where: { code: order.couponCode }, select: { code: true, label: true, kind: true, value: true } })
        : null,
});

/**
 * The student says they've paid by bKash: records the transaction ID and the
 * number they paid from on the order's payment, still PENDING, and asks the
 * admins to check it against the merchant statement. Access waits for an
 * admin's `markOrderPaid`.
 *
 * Priced first, like any checkout: a total that moved since the student last
 * saw it (a code ran out, the course was re-priced) stops here with the new
 * total rather than recording a payment for the old one.
 */
const submitBkashPayment = async (user: IRequestUser, orderId: string, submission: BkashSubmission) => {
    const seen = await prisma.order.findFirst({ where: { id: orderId, studentId: user.userId }, select: { total: true, couponCode: true } });
    if (!seen) throw new AppError(status.NOT_FOUND, "Order not found.");
    const repriced = await getMyOrder(user, orderId);
    if (repriced.status === OrderStatus.PENDING && (repriced.total !== seen.total || repriced.couponCode !== seen.couponCode)) {
        const total = `৳${repriced.total.toLocaleString("en-US")}`;
        throw new AppError(
            status.CONFLICT,
            seen.couponCode && !repriced.couponCode
                ? `The code ${seen.couponCode} can't be used any more, so it came off — the total is now ${total}. Check it before you pay.`
                : `The price has changed to ${total} — check it before you pay.`,
        );
    }

    const order = await prisma.order.findFirstOrThrow({
        where: { id: orderId, studentId: user.userId },
        include: { course: { select: { title: true, ...ENROLLMENT_RULE_SELECT } }, student: { select: { name: true } } },
    });
    if (order.status !== OrderStatus.PENDING) throw new AppError(status.BAD_REQUEST, "This order isn't awaiting payment.");
    if (order.total <= 0) throw new AppError(status.BAD_REQUEST, "This order needs no payment.");
    assertEnrollmentOpen(order.course);
    await assertTransactionUnused(submission.transactionId, { orderId: order.id });

    await prisma.$transaction(async (tx) => {
        await tx.payment.upsert({
            where: { orderId: order.id },
            create: {
                orderId: order.id,
                gateway: PaymentGateway.BKASH,
                transactionId: submission.transactionId,
                amount: order.total,
                status: OrderStatus.PENDING,
                gatewayData: bkashGatewayData(submission),
            },
            update: {
                gateway: PaymentGateway.BKASH,
                transactionId: submission.transactionId,
                amount: order.total,
                status: OrderStatus.PENDING,
                gatewayData: bkashGatewayData(submission),
                failureReason: null,
            },
        });
        // A limited code's use stays held for this student while the payment is checked.
        if (order.couponCode) await tx.order.update({ where: { id: order.id }, data: { couponAppliedAt: new Date() } });
    });

    await createNotification({
        userId: order.studentId,
        title: "Payment details received",
        message: `We got your bKash payment details for "${order.course.title}" (TrxID ${submission.transactionId}). We'll check it and open the course — you'll hear from us as soon as it's done.`,
        type: NotificationType.PAYMENT,
        link: `/checkout/${order.id}`,
        email: { actionLabel: "View your order" },
    });
    await notifyAdmins({
        title: `bKash payment to verify · ৳${order.total.toLocaleString("en-US")}`,
        message: `${order.student.name} paid for "${order.course.title}" (${order.orderNumber}) — TrxID ${submission.transactionId}, from ${submission.senderNumber}.`,
        type: NotificationType.PAYMENT,
        link: adminOrderLink(order),
    });

    return getMyOrder(user, orderId);
};

/**
 * Settles an order and grants access. Called when an admin confirms a payment
 * by hand — a bKash payment checked against the merchant statement, or any
 * other they took themselves.
 *
 * Idempotent: a gateway that retries its callback must not create a second
 * enrolment or a second payment row.
 */
export const markOrderPaid = async (input: {
    orderId: string;
    gateway: PaymentGateway;
    transactionId?: string;
    gatewayData?: unknown;
    /** The admin confirming it by hand, if it wasn't a gateway — they aren't told about their own action. */
    actorId?: string;
}) => {
    const order = await prisma.order.findUnique({
        where: { id: input.orderId },
        include: {
            course: { select: { id: true, title: true, slug: true } },
            student: { select: { name: true } },
            payment: { select: { id: true, status: true } },
        },
    });
    if (!order) throw new AppError(status.NOT_FOUND, "Order not found.");

    if (order.status === OrderStatus.PAID) {
        return prisma.order.findUniqueOrThrow({ where: { id: order.id }, include: orderInclude });
    }
    if (order.status === OrderStatus.REFUNDED) {
        throw new AppError(status.BAD_REQUEST, "This order has been refunded and cannot be settled.");
    }

    logger.update("Settling order", { orderId: order.id, gateway: input.gateway });

    const given = await prisma.$transaction(async (tx) => {
        await tx.order.update({
            where: { id: order.id },
            data: { status: OrderStatus.PAID },
        });

        await tx.payment.upsert({
            where: { orderId: order.id },
            create: {
                orderId: order.id,
                gateway: input.gateway,
                transactionId: input.transactionId,
                amount: order.total,
                status: OrderStatus.PAID,
                gatewayData: (input.gatewayData ?? undefined) as never,
                paidAt: new Date(),
            },
            update: {
                gateway: input.gateway,
                transactionId: input.transactionId,
                status: OrderStatus.PAID,
                gatewayData: (input.gatewayData ?? undefined) as never,
                paidAt: new Date(),
                failureReason: null,
            },
        });

        await activateEnrollment(tx, {
            studentId: order.studentId,
            courseId: order.courseId,
            orderId: order.id,
        });

        // The offer's free courses, in the same transaction: paid means given.
        return grantOfferCourses(tx, order);
    });

    await createNotification({
        userId: order.studentId,
        title: "Payment received",
        message: `Your payment for "${order.course.title}" is confirmed. The course is now in your dashboard.`,
        type: NotificationType.PAYMENT,
        link: `/learn/${order.course.slug}`,
    });
    await announceGrants(order.studentId, given, `They came free with "${order.course.title}".`);

    // A sale is every admin's business — except the one who just confirmed it.
    await notifyAdmins(
        {
            title: `Payment received · ৳${order.total.toLocaleString("en-US")}`,
            message: `${order.student.name} paid for "${order.course.title}" (${order.orderNumber}).`,
            type: NotificationType.PAYMENT,
            link: adminOrderLink(order),
        },
        input.actorId,
    );

    const finalOrder = await prisma.order.findUniqueOrThrow({ where: { id: order.id }, include: orderInclude });
    sendInvoiceEmail(finalOrder);
    return finalOrder;
};

const markOrderFailed = async (input: { orderId: string; reason?: string }) => {
    const order = await prisma.order.findUnique({
        where: { id: input.orderId },
        select: {
            id: true,
            status: true,
            total: true,
            studentId: true,
            course: { select: { title: true, slug: true } },
            payment: { select: { transactionId: true } },
        },
    });
    if (!order) throw new AppError(status.NOT_FOUND, "Order not found.");
    if (order.status === OrderStatus.PAID) {
        throw new AppError(status.BAD_REQUEST, "This order is already paid. Refund it instead.");
    }

    await prisma.$transaction(async (tx) => {
        await tx.order.update({ where: { id: order.id }, data: { status: OrderStatus.FAILED } });
        await tx.payment.upsert({
            where: { orderId: order.id },
            create: {
                orderId: order.id,
                gateway: PaymentGateway.MANUAL,
                amount: order.total,
                status: OrderStatus.FAILED,
                failureReason: input.reason,
            },
            update: { status: OrderStatus.FAILED, failureReason: input.reason },
        });
    });

    // A bKash payment the admin couldn't match: tell the student, so they can
    // check it and try again (a new order) rather than wait on this one.
    if (order.payment?.transactionId) {
        await createNotification({
            userId: order.studentId,
            title: "We couldn't verify your payment",
            message:
                `Your bKash payment for "${order.course.title}" (TrxID ${order.payment.transactionId}) couldn't be verified` +
                `${input.reason ? `: ${input.reason}` : "."} Please check it and try again, or contact support.`,
            type: NotificationType.PAYMENT,
            link: `/courses/${order.course.slug}`,
            email: { actionLabel: "Open the course" },
        });
    }

    return prisma.order.findUniqueOrThrow({ where: { id: order.id }, include: orderInclude });
};

/**
 * Refund — revokes access but keeps the order and learning history. The free
 * courses the order earned through an offer go with it.
 */
const refundOrder = async (orderId: string, reason?: string) => {
    const order = await prisma.order.findUnique({
        where: { id: orderId },
        select: { id: true, status: true, studentId: true, courseId: true },
    });
    if (!order) throw new AppError(status.NOT_FOUND, "Order not found.");
    if (order.status !== OrderStatus.PAID) {
        throw new AppError(status.BAD_REQUEST, "Only a paid order can be refunded.");
    }

    await prisma.$transaction(async (tx) => {
        await tx.order.update({ where: { id: orderId }, data: { status: OrderStatus.REFUNDED } });
        await tx.payment.updateMany({
            where: { orderId },
            data: { status: OrderStatus.REFUNDED, failureReason: reason },
        });
        await tx.enrollment.updateMany({
            where: { studentId: order.studentId, courseId: order.courseId },
            data: { status: EnrollmentStatus.CANCELLED },
        });
        await revokeOfferGrants(tx, orderId);
    });

    return prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: orderInclude });
};

const getMyOrders = async (user: IRequestUser, query: IQueryParams) => {
    return new QueryBuilder(prisma.order, query, {
        filterableFields: ["status", "courseId"],
        maxLimit: 50,
    })
        .filter()
        .sort()
        .paginate()
        .include(orderInclude)
        .where({ studentId: user.userId })
        .execute();
};

/** The student's own order — an unpaid one re-priced first, so the receipt shows today's price. */
const getMyOrder = async (user: IRequestUser, orderId: string) => {
    const order = await prisma.order.findFirst({
        where: { id: orderId, studentId: user.userId },
        include: orderInclude,
    });
    if (!order) throw new AppError(status.NOT_FOUND, "Order not found.");
    return withCoupon(await repricePending(order));
};

/** The receipt is only meaningful once money has actually changed hands. */
const downloadMyInvoice = async (user: IRequestUser, orderId: string) => {
    const order = await getMyOrder(user, orderId);
    if (order.status !== OrderStatus.PAID) {
        throw new AppError(status.BAD_REQUEST, "This order hasn't been paid yet.");
    }
    const pdf = await buildInvoicePdf(toInvoiceData(order));
    return { pdf, orderNumber: order.orderNumber };
};

/** The admin list also carries the photo and what the order turned into. */
const adminOrderInclude = {
    ...orderInclude,
    student: {
        select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            image: true,
        },
    },
    enrollment: { select: { id: true, status: true, progress: true } },
} as const;

type AdminOrderRow = Prisma.OrderGetPayload<{ include: typeof adminOrderInclude }>;

/**
 * A failed order stays failed — trying again places a new order — so each
 * failed one carries the order the student paid for the same course
 * afterwards, if any. It's how the Failed payments screen tells a student
 * still worth a call from one who has already sorted it out.
 */
const withPaidLater = async (orders: AdminOrderRow[]) => {
    const failed = orders.filter((order) => order.status === OrderStatus.FAILED);
    const paid = failed.length
        ? await prisma.order.findMany({
              where: {
                  status: OrderStatus.PAID,
                  OR: failed.map((order) => ({ studentId: order.studentId, courseId: order.courseId })),
              },
              select: { id: true, orderNumber: true, studentId: true, courseId: true, createdAt: true, payment: { select: { paidAt: true } } },
              orderBy: { createdAt: "asc" },
          })
        : [];

    return orders.map((order) => {
        const later =
            order.status === OrderStatus.FAILED
                ? paid.find((p) => p.studentId === order.studentId && p.courseId === order.courseId && p.createdAt > order.createdAt)
                : undefined;
        return {
            ...order,
            paidLater: later ? { id: later.id, orderNumber: later.orderNumber, paidAt: later.payment?.paidAt ?? null } : null,
        };
    });
};

const getAllOrders = async (query: IQueryParams) => {
    const result = await new QueryBuilder<AdminOrderRow>(prisma.order, query, {
        searchableFields: ["orderNumber", "student.name", "student.email", "student.phone", "course.title"],
        // The payment times take a range (`payment.paidAt[gte]=`) — the
        // Successful and Failed payments screens' "Today / 7 days / 30 days".
        filterableFields: ["status", "courseId", "studentId", "payment.paidAt", "payment.updatedAt"],
        maxLimit: 100,
    })
        .search()
        .filter()
        .sort()
        .paginate()
        .include(adminOrderInclude)
        .execute();

    return { ...result, data: await withPaidLater(result.data) };
};

/** The orders list as a CSV — same filters, search and order as on screen. */
const exportOrders = async (query: IQueryParams) => {
    const orders = await collectAll(getAllOrders, query);
    return toCsv(
        ["Order", "Placed", "Status", "Student", "Email", "Phone", "Course", "Price", "Discount", "Total", "Currency", "Coupon", "Gateway", "Transaction", "Paid"],
        orders.map((order) => [
            order.orderNumber,
            order.createdAt,
            order.status,
            order.student.name,
            order.student.email,
            order.student.phone,
            order.course.title,
            order.amount,
            order.discount,
            order.total,
            order.currency,
            order.couponCode,
            order.payment?.gateway,
            order.payment?.transactionId,
            order.payment?.paidAt,
        ]),
    );
};

/**
 * Orders rolled up per course: how many sit in each status, what's been
 * collected (PAID — a refund moves an order out, so this is net), what's
 * still awaiting payment, and when the last order came in.
 */
const summariseOrders = async (courseIds?: string[]) => {
    const groups = await prisma.order.groupBy({
        by: ["courseId", "status"],
        ...(courseIds ? { where: { courseId: { in: courseIds } } } : {}),
        _count: { _all: true },
        _sum: { total: true },
        _max: { createdAt: true },
    });

    const byCourse = new Map<
        string,
        { counts: Record<OrderStatus, number>; collected: number; awaiting: number; lastOrderAt: Date | null }
    >();
    for (const group of groups) {
        const entry = byCourse.get(group.courseId) ?? {
            counts: { PENDING: 0, PAID: 0, FAILED: 0, CANCELLED: 0, REFUNDED: 0 },
            collected: 0,
            awaiting: 0,
            lastOrderAt: null,
        };
        entry.counts[group.status] = group._count._all;
        if (group.status === OrderStatus.PAID) entry.collected = group._sum.total ?? 0;
        if (group.status === OrderStatus.PENDING) entry.awaiting = group._sum.total ?? 0;
        const last = group._max.createdAt;
        if (last && (!entry.lastOrderAt || last > entry.lastOrderAt)) entry.lastOrderAt = last;
        byCourse.set(group.courseId, entry);
    }
    return byCourse;
};

const toCourseSummary = (course: AdminCourseCard, summary: Awaited<ReturnType<typeof summariseOrders>>) => {
    const entry = summary.get(course.id);
    const counts = entry?.counts ?? { PENDING: 0, PAID: 0, FAILED: 0, CANCELLED: 0, REFUNDED: 0 };
    return {
        course,
        counts: { ...counts, total: Object.values(counts).reduce((sum, n) => sum + n, 0) },
        collected: entry?.collected ?? 0,
        awaiting: entry?.awaiting ?? 0,
        lastOrderAt: entry?.lastOrderAt ?? null,
    };
};

/**
 * The Payments screen's first view: every course with its orders rolled up,
 * so an admin picks a course before reading individual orders. A deleted
 * course still shows while it has orders — they're money records.
 * Courses waiting on a payment come first, then the most recently ordered.
 */
const getOrderCourses = async (query: IQueryParams) => {
    const searchTerm = typeof query.searchTerm === "string" ? query.searchTerm.trim() : "";
    const [courses, summary] = await Promise.all([
        prisma.course.findMany({
            where: {
                OR: [{ isDeleted: false }, { orders: { some: {} } }],
                ...(searchTerm ? { title: { contains: searchTerm, mode: "insensitive" as const } } : {}),
            },
            select: adminCourseSelect,
        }),
        summariseOrders(),
    ]);

    return courses
        .map((course) => toCourseSummary(course, summary))
        .sort(
            (a, b) =>
                b.counts.PENDING - a.counts.PENDING ||
                (b.lastOrderAt?.getTime() ?? 0) - (a.lastOrderAt?.getTime() ?? 0) ||
                a.course.title.localeCompare(b.course.title),
        );
};

/** One course's roll-up, for the header of its order list. */
const getOrderCourse = async (courseId: string) => {
    const course = await prisma.course.findUnique({ where: { id: courseId }, select: adminCourseSelect });
    if (!course) throw new AppError(status.NOT_FOUND, "Course not found");
    return toCourseSummary(course, await summariseOrders([courseId]));
};

export const OrderService = {
    setOrderCoupon,
    exportOrders,
    createOrder,
    markOrderPaid,
    markOrderFailed,
    submitBkashPayment,
    refundOrder,
    getMyOrders,
    getMyOrder,
    downloadMyInvoice,
    getAllOrders,
    getOrderCourses,
    getOrderCourse,
};
