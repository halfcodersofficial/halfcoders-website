import status from "http-status";
import { Prisma } from "../../../generated/prisma/client";
import {
    BundlePricing,
    CourseStatus,
    EnrollmentStatus,
    NotificationType,
    OrderStatus,
    PaymentGateway,
} from "../../../generated/prisma/enums";
import AppError from "../../errorHelpers/AppError";
import { IRequestUser } from "../../interfaces/requestUser.interface";
import { prisma } from "../../lib/prisma";
import { assertTransactionUnused, bkashGatewayData, BkashSubmission } from "../../utils/bkash";
import { quoteBundle, type BundleCoursePrice } from "../../utils/bundlePricing";
import { assertEnrollmentOpen, ENROLLMENT_RULE_SELECT } from "../../utils/courseBatch";
import { announceGrants, grantBonusCourses, isLive, type GivenCourse } from "../../utils/courseGrants";
import { logger } from "../../utils/logger";
import { nextBundleOrderNumber, nextOrderNumber, withUniqueRetry } from "../../utils/referenceNumber";
import { generateBundleSlug } from "../../utils/slug";
import { activateEnrollment } from "../enrollment/enrollment.service";
import { createNotification, notifyAdmins } from "../notification/notification.service";
import { OrderService } from "../order/order.service";

/**
 * Course bundles: several courses at one price. A student pays once (a
 * `BundleOrder`); when that's settled, each course they didn't already own
 * gets its own PAID order for its share of the total, and its enrolment —
 * so per-course sales, refunds and invoices carry on as before.
 */

const bundleCourseSelect = {
    id: true,
    title: true,
    slug: true,
    thumbnail: true,
    subtitle: true,
    price: true,
    discountPrice: true,
    level: true,
    phase: true,
    pricing: true,
    delivery: true,
    mode: true,
    isDeleted: true,
    category: { select: { title: true } },
    ...ENROLLMENT_RULE_SELECT,
} as const;

const bundleInclude = {
    items: { orderBy: { order: "asc" }, include: { course: { select: bundleCourseSelect } } },
} as const;

type BundleWithCourses = Prisma.CourseBundleGetPayload<{ include: typeof bundleInclude }>;
type BundleCourse = BundleWithCourses["items"][number]["course"];

/** What a bundle order is buying, as stored on it. */
interface BundleOrderItem {
    courseId: string;
    title: string;
    salePrice: number;
    share: number;
}

const HAS_ACCESS: EnrollmentStatus[] = [EnrollmentStatus.ACTIVE, EnrollmentStatus.COMPLETED];

const coursesOf = (bundle: BundleWithCourses) => bundle.items.map((item) => item.course);

/** On sale: switched on, inside its window, and every course in it published. */
const isSellable = (bundle: BundleWithCourses, now = new Date()) =>
    isLive(bundle, now) && coursesOf(bundle).every((course) => !course.isDeleted && course.status === CourseStatus.PUBLISHED);

const priceInputs = (courses: BundleCourse[]): BundleCoursePrice[] =>
    courses.map((course) => ({ courseId: course.id, title: course.title, price: course.price, discountPrice: course.discountPrice }));

/** The courses of these this student has access to now. */
const ownedOf = async (studentId: string | undefined, courseIds: string[]) => {
    if (!studentId || courseIds.length === 0) return new Set<string>();
    const rows = await prisma.enrollment.findMany({
        where: { studentId, courseId: { in: courseIds }, status: { in: HAS_ACCESS } },
        select: { courseId: true },
    });
    return new Set(rows.map((row) => row.courseId));
};

/** A bundle as the public pages show it, priced for the viewer when they're signed in. */
const toPublicBundle = (bundle: BundleWithCourses, owned: ReadonlySet<string>) => {
    const courses = coursesOf(bundle);
    const quote = quoteBundle(bundle, priceInputs(courses), owned);
    return {
        id: bundle.id,
        title: bundle.title,
        slug: bundle.slug,
        description: bundle.description,
        thumbnail: bundle.thumbnail,
        pricing: bundle.pricing,
        discountPercent: bundle.discountPercent,
        endsAt: bundle.endsAt,
        courses: courses.map((course) => ({
            id: course.id,
            title: course.title,
            slug: course.slug,
            subtitle: course.subtitle,
            thumbnail: course.thumbnail,
            price: course.price,
            discountPrice: course.discountPrice,
            level: course.level,
            phase: course.phase,
            delivery: course.delivery,
            mode: course.mode,
            category: course.category,
            owned: owned.has(course.id),
        })),
        quote: {
            /** Every course on its own, at today's sale prices. */
            combined: quote.combined,
            bundlePrice: quote.bundlePrice,
            /** What buying the whole bundle saves on buying them one by one. */
            savings: quote.combined - quote.bundlePrice,
            /** This viewer's price — less when they own some already. */
            total: quote.total,
            ownedCount: owned.size,
            ownsAll: quote.ownsAll,
        },
    };
};

const liveBundleWhere = (now = new Date()): Prisma.CourseBundleWhereInput => ({
    isActive: true,
    AND: [
        { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
        { OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
    ],
});

// ---------------------------------------------------------------------------
// Public
// ---------------------------------------------------------------------------

/** The bundles page: every bundle on sale now, in the admin's order. */
const getPublicBundles = async (user?: IRequestUser) => {
    const bundles = await prisma.courseBundle.findMany({
        where: liveBundleWhere(),
        orderBy: [{ order: "asc" }, { createdAt: "desc" }],
        include: bundleInclude,
    });
    const sellable = bundles.filter((bundle) => isSellable(bundle));
    const owned = await ownedOf(user?.userId, [...new Set(sellable.flatMap((bundle) => coursesOf(bundle).map((c) => c.id)))]);
    return sellable.map((bundle) => toPublicBundle(bundle, owned));
};

const getPublicBundle = async (slug: string, user?: IRequestUser) => {
    const bundle = await prisma.courseBundle.findUnique({ where: { slug }, include: bundleInclude });
    if (!bundle || !isSellable(bundle)) throw new AppError(status.NOT_FOUND, "This bundle isn't on sale.");
    return toPublicBundle(bundle, await ownedOf(user?.userId, coursesOf(bundle).map((course) => course.id)));
};

/** The bundles on sale that hold this course — for its page. */
export const bundlesWithCourse = async (courseId: string, user?: IRequestUser) => {
    const bundles = await prisma.courseBundle.findMany({
        where: { ...liveBundleWhere(), items: { some: { courseId } } },
        orderBy: [{ order: "asc" }, { createdAt: "desc" }],
        include: bundleInclude,
    });
    const sellable = bundles.filter((bundle) => isSellable(bundle));
    const owned = await ownedOf(user?.userId, [...new Set(sellable.flatMap((bundle) => coursesOf(bundle).map((c) => c.id)))]);
    return sellable.map((bundle) => toPublicBundle(bundle, owned));
};

// ---------------------------------------------------------------------------
// Checkout
// ---------------------------------------------------------------------------

const bundleOrderInclude = {
    bundle: { select: { id: true, title: true, slug: true, thumbnail: true } },
    orders: {
        select: {
            id: true,
            orderNumber: true,
            total: true,
            status: true,
            course: { select: { id: true, title: true, slug: true, thumbnail: true } },
        },
    },
} as const;

/** Every course still to buy must be open for enrolment — a bootcamp outside its window isn't. */
const assertCoursesOpen = (courses: BundleCourse[]) => {
    for (const course of courses) {
        try {
            assertEnrollmentOpen(course);
        } catch (error) {
            if (error instanceof AppError) throw new AppError(error.statusCode, `${course.title}: ${error.message}`);
            throw error;
        }
    }
};

/**
 * Starts a bundle checkout for the courses this student doesn't own yet,
 * priced from the database. An unpaid one for the same bundle is re-priced
 * and reused rather than stacking up duplicates.
 */
const createBundleOrder = async (user: IRequestUser, bundleId: string) => {
    const bundle = await prisma.courseBundle.findUnique({ where: { id: bundleId }, include: bundleInclude });
    if (!bundle || !isSellable(bundle)) throw new AppError(status.NOT_FOUND, "This bundle isn't on sale.");

    const courses = coursesOf(bundle);
    const owned = await ownedOf(user.userId, courses.map((course) => course.id));
    const quote = quoteBundle(bundle, priceInputs(courses), owned);
    if (quote.ownsAll) throw new AppError(status.CONFLICT, "You already have every course in this bundle.");
    assertCoursesOpen(courses.filter((course) => !owned.has(course.id)));

    const items: BundleOrderItem[] = quote.lines
        .filter((line) => !line.owned)
        .map((line) => ({ courseId: line.courseId, title: line.title, salePrice: line.salePrice, share: line.share }));
    const priced = {
        amount: quote.amount,
        discount: quote.discount,
        total: quote.total,
        items: items as unknown as Prisma.InputJsonValue,
    };

    const pending = await prisma.bundleOrder.findFirst({
        where: { studentId: user.userId, bundleId, status: OrderStatus.PENDING },
        select: { id: true },
    });
    const order = pending
        ? await prisma.bundleOrder.update({ where: { id: pending.id }, data: priced, include: bundleOrderInclude })
        : await withUniqueRetry(async () =>
              prisma.bundleOrder.create({
                  data: { orderNumber: await nextBundleOrderNumber(), studentId: user.userId, bundleId, ...priced },
                  include: bundleOrderInclude,
              }),
          );
    logger.create("Bundle checkout", { bundleOrderId: order.id, bundleId, total: order.total });

    // Nothing to pay (every course left is free): settled there and then.
    if (order.total === 0) return settleBundleOrder(order.id, { gateway: PaymentGateway.FREE });
    return order;
};

/**
 * Re-prices an unpaid bundle order from the courses as they are now — a
 * course made free or paid, re-priced, or bought separately since. One that
 * leaves nothing to buy is cancelled; one that leaves nothing to pay is
 * settled there and then.
 */
const repricePendingBundle = async (bundleOrderId: string) => {
    const order = await prisma.bundleOrder.findUnique({
        where: { id: bundleOrderId },
        include: { bundle: { include: bundleInclude } },
    });
    if (!order || order.status !== OrderStatus.PENDING) return;

    const courses = coursesOf(order.bundle);
    const owned = await ownedOf(order.studentId, courses.map((course) => course.id));
    const quote = quoteBundle(order.bundle, priceInputs(courses), owned);
    if (quote.ownsAll) {
        await prisma.bundleOrder.update({
            where: { id: order.id },
            data: { status: OrderStatus.CANCELLED, failureReason: "Every course in the bundle is already yours." },
        });
        return;
    }

    const items: BundleOrderItem[] = quote.lines
        .filter((line) => !line.owned)
        .map((line) => ({ courseId: line.courseId, title: line.title, salePrice: line.salePrice, share: line.share }));
    // Compared field by field: jsonb doesn't keep the keys in the order they were written.
    const sig = (list: BundleOrderItem[]) => list.map((item) => `${item.courseId}:${item.salePrice}:${item.share}`).join("|");
    if (quote.total === order.total && quote.amount === order.amount && sig(items) === sig(order.items as unknown as BundleOrderItem[])) return;

    logger.update("Bundle order re-priced", { bundleOrderId: order.id, from: order.total, to: quote.total });
    await prisma.bundleOrder.update({
        where: { id: order.id },
        data: { amount: quote.amount, discount: quote.discount, total: quote.total, items: items as unknown as Prisma.InputJsonValue },
    });
    if (quote.total === 0) await settleBundleOrder(order.id, { gateway: PaymentGateway.FREE });
};

/** The student's own bundle order — an unpaid one re-priced first, so the receipt shows today's prices. */
const getMyBundleOrder = async (user: IRequestUser, bundleOrderId: string) => {
    const mine = await prisma.bundleOrder.findFirst({ where: { id: bundleOrderId, studentId: user.userId }, select: { id: true } });
    if (!mine) throw new AppError(status.NOT_FOUND, "Order not found.");
    await repricePendingBundle(mine.id);
    return prisma.bundleOrder.findUniqueOrThrow({ where: { id: mine.id }, include: bundleOrderInclude });
};

/**
 * The student says they've paid for a bundle by bKash: the transaction ID and
 * the number they paid from go on the bundle order, still PENDING, for an
 * admin to check against the merchant statement (`markBundlePaid`).
 */
const submitBkashBundlePayment = async (user: IRequestUser, bundleOrderId: string, submission: BkashSubmission) => {
    const seen = await prisma.bundleOrder.findFirst({ where: { id: bundleOrderId, studentId: user.userId }, select: { total: true } });
    if (!seen) throw new AppError(status.NOT_FOUND, "Order not found.");
    // Priced first: a total that moved since the student last saw it stops here.
    const repriced = await getMyBundleOrder(user, bundleOrderId);
    if (repriced.status === OrderStatus.PENDING && repriced.total !== seen.total) {
        throw new AppError(status.CONFLICT, `The price has changed to ৳${repriced.total.toLocaleString("en-US")} — check it before you pay.`);
    }

    const order = await prisma.bundleOrder.findFirstOrThrow({
        where: { id: bundleOrderId, studentId: user.userId },
        include: { bundle: { include: bundleInclude }, student: { select: { name: true } } },
    });
    if (order.status !== OrderStatus.PENDING) throw new AppError(status.BAD_REQUEST, "This order isn't awaiting payment.");
    if (order.total <= 0) throw new AppError(status.BAD_REQUEST, "This order needs no payment.");
    if (!isSellable(order.bundle)) throw new AppError(status.CONFLICT, "This bundle isn't on sale any more.");

    const buying = new Set((order.items as unknown as BundleOrderItem[]).map((item) => item.courseId));
    assertCoursesOpen(coursesOf(order.bundle).filter((course) => buying.has(course.id)));
    await assertTransactionUnused(submission.transactionId, { bundleOrderId: order.id });

    await prisma.bundleOrder.update({
        where: { id: order.id },
        data: {
            gateway: PaymentGateway.BKASH,
            transactionId: submission.transactionId,
            gatewayData: bkashGatewayData(submission),
            failureReason: null,
        },
    });

    await createNotification({
        userId: order.studentId,
        title: "Payment details received",
        message: `We got your bKash payment details for "${order.bundle.title}" (TrxID ${submission.transactionId}). We'll check it and open the courses — you'll hear from us as soon as it's done.`,
        type: NotificationType.PAYMENT,
        link: `/checkout/bundle/${order.id}`,
        email: { actionLabel: "View your order" },
    });
    await notifyAdmins({
        title: `bKash payment to verify · ৳${order.total.toLocaleString("en-US")}`,
        message: `${order.student.name} paid for the bundle "${order.bundle.title}" (${order.orderNumber}) — TrxID ${submission.transactionId}, from ${submission.senderNumber}.`,
        type: NotificationType.PAYMENT,
        link: "/admin/bundles",
    });

    return prisma.bundleOrder.findUniqueOrThrow({ where: { id: order.id }, include: bundleOrderInclude });
};

/**
 * Settles a bundle order: marks it paid, and for each course on it creates a
 * PAID order for its share (with its payment row) and opens the enrolment —
 * all in one transaction. Idempotent: a repeated callback finds it paid and
 * does nothing, and two at once can't both claim it (the status flip is
 * conditional).
 */
const settleBundleOrder = async (
    bundleOrderId: string,
    input: { gateway: PaymentGateway; transactionId?: string; gatewayData?: unknown; actorId?: string },
) => {
    const order = await prisma.bundleOrder.findUnique({
        where: { id: bundleOrderId },
        include: { bundle: { select: { title: true } }, student: { select: { name: true } } },
    });
    if (!order) throw new AppError(status.NOT_FOUND, "Order not found.");
    if (order.status === OrderStatus.PAID) {
        return prisma.bundleOrder.findUniqueOrThrow({ where: { id: order.id }, include: bundleOrderInclude });
    }
    if (order.status === OrderStatus.REFUNDED) {
        throw new AppError(status.BAD_REQUEST, "This order has been refunded and cannot be settled.");
    }

    const items = order.items as unknown as BundleOrderItem[];
    const courses = await prisma.course.findMany({
        where: { id: { in: items.map((item) => item.courseId) } },
        select: { id: true, price: true },
    });
    const listPrice = new Map(courses.map((course) => [course.id, course.price]));
    const paidAt = new Date();

    // The reward courses each bundled course brings, gathered as they're given.
    const rewards: GivenCourse[] = [];
    const settled = await withUniqueRetry(() =>
        prisma.$transaction(async (tx) => {
            rewards.length = 0;
            const claimed = await tx.bundleOrder.updateMany({
                where: { id: order.id, status: { notIn: [OrderStatus.PAID, OrderStatus.REFUNDED] } },
                data: {
                    status: OrderStatus.PAID,
                    gateway: input.gateway,
                    transactionId: input.transactionId,
                    gatewayData: (input.gatewayData ?? undefined) as never,
                    paidAt,
                    failureReason: null,
                },
            });
            if (claimed.count === 0) return false;

            for (const item of items) {
                // The course's list price, with the bundle's share taken off it.
                const amount = Math.max(listPrice.get(item.courseId) ?? item.salePrice, item.share);
                const child = await tx.order.create({
                    data: {
                        orderNumber: await nextOrderNumber(tx),
                        studentId: order.studentId,
                        courseId: item.courseId,
                        amount,
                        discount: amount - item.share,
                        total: item.share,
                        status: OrderStatus.PAID,
                        bundleOrderId: order.id,
                    },
                });
                await tx.payment.create({
                    data: {
                        orderId: child.id,
                        gateway: input.gateway,
                        amount: item.share,
                        status: OrderStatus.PAID,
                        paidAt,
                        gatewayData: { bundleOrderNumber: order.orderNumber },
                    },
                });
                await activateEnrollment(tx, { studentId: order.studentId, courseId: item.courseId, orderId: child.id });
                rewards.push(...(await grantBonusCourses(tx, order.studentId, item.courseId)));
            }
            return true;
        }),
    );

    if (settled) {
        logger.update("Bundle order settled", { bundleOrderId: order.id, gateway: input.gateway });
        await createNotification({
            userId: order.studentId,
            title: "Bundle purchased 🎉",
            message: `Your payment for "${order.bundle.title}" is confirmed. ${items.length} course(s) are now in your dashboard.`,
            type: NotificationType.PAYMENT,
            link: "/dashboard",
            email: { actionLabel: "Open your dashboard" },
        });
        await announceGrants(order.studentId, rewards, `They come with the courses in "${order.bundle.title}".`, "reward course");
        await notifyAdmins(
            {
                title: `Bundle sold · ৳${order.total.toLocaleString("en-US")}`,
                message: `${order.student.name} bought "${order.bundle.title}" (${order.orderNumber}).`,
                type: NotificationType.PAYMENT,
                link: "/admin/bundles",
            },
            input.actorId,
        );
    }

    return prisma.bundleOrder.findUniqueOrThrow({ where: { id: order.id }, include: bundleOrderInclude });
};

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

type BundleInput = {
    title?: string;
    description?: string | null;
    thumbnail?: string | null;
    pricing?: BundlePricing;
    price?: number | null;
    discountPercent?: number | null;
    isActive?: boolean;
    startsAt?: Date | null;
    endsAt?: Date | null;
    order?: number;
    courseIds?: string[];
};

/** Every bundle with its courses, and what it has sold. */
const listBundles = async () => {
    const [bundles, sales] = await Promise.all([
        prisma.courseBundle.findMany({ orderBy: [{ order: "asc" }, { createdAt: "desc" }], include: bundleInclude }),
        prisma.bundleOrder.groupBy({
            by: ["bundleId", "status"],
            _count: { _all: true },
            _sum: { total: true },
        }),
    ]);
    return bundles.map((bundle) => {
        const paid = sales.find((row) => row.bundleId === bundle.id && row.status === OrderStatus.PAID);
        const pending = sales.find((row) => row.bundleId === bundle.id && row.status === OrderStatus.PENDING);
        const quote = quoteBundle(bundle, priceInputs(coursesOf(bundle)), new Set());
        return {
            ...bundle,
            combined: quote.combined,
            bundlePrice: quote.bundlePrice,
            sellable: isSellable(bundle),
            sold: paid?._count._all ?? 0,
            revenue: paid?._sum.total ?? 0,
            pending: pending?._count._all ?? 0,
        };
    });
};

/**
 * The courses, all real and not deleted, and the price checked against them:
 * a fixed price must come in under buying them one by one, or it's no deal.
 */
const checkContents = async (pricing: BundlePricing, price: number | null | undefined, courseIds: string[]) => {
    const courses = await prisma.course.findMany({
        where: { id: { in: courseIds }, isDeleted: false },
        select: { id: true, price: true, discountPrice: true },
    });
    if (courses.length !== courseIds.length) throw new AppError(status.BAD_REQUEST, "One of those courses doesn't exist.");
    const combined = courses.reduce((sum, course) => sum + (course.discountPrice ?? course.price), 0);
    if (pricing === BundlePricing.FIXED && price !== null && price !== undefined && price >= combined) {
        throw new AppError(
            status.BAD_REQUEST,
            `A fixed price must be less than the courses cost on their own (৳${combined.toLocaleString("en-US")}).`,
        );
    }
};

const itemsFrom = (courseIds: string[]) => courseIds.map((courseId, order) => ({ courseId, order }));

const createBundle = async (payload: BundleInput & { title: string; pricing: BundlePricing; courseIds: string[] }) => {
    await checkContents(payload.pricing, payload.price, payload.courseIds);
    const { courseIds, ...rest } = payload;
    logger.create("Creating bundle", { title: payload.title });
    return prisma.courseBundle.create({
        data: {
            ...rest,
            // Only the field the pricing uses is kept.
            price: payload.pricing === BundlePricing.FIXED ? payload.price : null,
            discountPercent: payload.pricing === BundlePricing.PERCENT ? payload.discountPercent : null,
            slug: await generateBundleSlug(payload.title),
            items: { create: itemsFrom(courseIds) },
        },
        include: bundleInclude,
    });
};

const updateBundle = async (bundleId: string, payload: BundleInput) => {
    const bundle = await prisma.courseBundle.findUnique({ where: { id: bundleId }, include: { items: { orderBy: { order: "asc" } } } });
    if (!bundle) throw new AppError(status.NOT_FOUND, "Bundle not found.");

    const pricing = payload.pricing ?? bundle.pricing;
    const price = payload.price === undefined ? bundle.price : payload.price;
    const discountPercent = payload.discountPercent === undefined ? bundle.discountPercent : payload.discountPercent;
    if (pricing === BundlePricing.FIXED ? price === null : discountPercent === null) {
        throw new AppError(status.BAD_REQUEST, "Set the bundle's price or its discount.");
    }
    const courseIds = payload.courseIds ?? bundle.items.map((item) => item.courseId);
    await checkContents(pricing, price, courseIds);

    const { courseIds: _ids, ...rest } = payload;
    logger.update("Updating bundle", { bundleId });
    return prisma.$transaction(async (tx) => {
        if (payload.courseIds) {
            await tx.courseBundleItem.deleteMany({ where: { bundleId } });
            await tx.courseBundleItem.createMany({ data: itemsFrom(payload.courseIds).map((item) => ({ ...item, bundleId })) });
        }
        return tx.courseBundle.update({
            where: { id: bundleId },
            data: {
                ...rest,
                price: pricing === BundlePricing.FIXED ? price : null,
                discountPercent: pricing === BundlePricing.PERCENT ? discountPercent : null,
                ...(payload.title && payload.title !== bundle.title ? { slug: await generateBundleSlug(payload.title, bundleId) } : {}),
            },
            include: bundleInclude,
        });
    });
};

/** Deletes a bundle nobody has ordered; one with orders stays for the record — switch it off instead. */
const deleteBundle = async (bundleId: string) => {
    const orders = await prisma.bundleOrder.count({ where: { bundleId } });
    if (orders > 0) throw new AppError(status.CONFLICT, "This bundle has orders — switch it off instead of deleting it.");
    await prisma.courseBundle.delete({ where: { id: bundleId } });
};

/** A bundle's checkouts, newest first, with the student and the course orders each became. */
const listBundleOrders = async (bundleId: string) =>
    prisma.bundleOrder.findMany({
        where: { bundleId },
        orderBy: { createdAt: "desc" },
        take: 200,
        include: { ...bundleOrderInclude, student: { select: { id: true, name: true, email: true, phone: true, image: true } } },
    });

/**
 * An admin confirming a payment: a bKash payment the student sent in (checked
 * against the merchant statement — its transaction ID stays on the order), or
 * one that came in some other way (cash, bank).
 */
const markBundlePaid = async (actor: IRequestUser, bundleOrderId: string) => {
    const order = await prisma.bundleOrder.findUnique({ where: { id: bundleOrderId }, select: { gateway: true } });
    return settleBundleOrder(bundleOrderId, { gateway: order?.gateway ?? PaymentGateway.MANUAL, actorId: actor.userId });
};

/** An admin turning down a bKash payment they couldn't match; the student is told why. */
const rejectBundleOrder = async (bundleOrderId: string, reason?: string) => {
    const order = await prisma.bundleOrder.findUnique({
        where: { id: bundleOrderId },
        include: { bundle: { select: { title: true, slug: true } } },
    });
    if (!order) throw new AppError(status.NOT_FOUND, "Order not found.");
    if (order.status !== OrderStatus.PENDING) throw new AppError(status.BAD_REQUEST, "Only an order awaiting payment can be turned down.");

    const updated = await prisma.bundleOrder.update({
        where: { id: order.id },
        data: { status: OrderStatus.FAILED, failureReason: reason },
        include: bundleOrderInclude,
    });
    if (order.transactionId) {
        await createNotification({
            userId: order.studentId,
            title: "We couldn't verify your payment",
            message:
                `Your bKash payment for "${order.bundle.title}" (TrxID ${order.transactionId}) couldn't be verified` +
                `${reason ? `: ${reason}` : "."} Please check it and try again, or contact support.`,
            type: NotificationType.PAYMENT,
            link: `/bundles/${order.bundle.slug}`,
            email: { actionLabel: "Open the bundle" },
        });
    }
    return updated;
};

/**
 * Refunds the whole bundle: each course order it became is refunded (which
 * takes away that course), and the bundle order is marked refunded.
 */
const refundBundleOrder = async (bundleOrderId: string, reason?: string) => {
    const order = await prisma.bundleOrder.findUnique({
        where: { id: bundleOrderId },
        include: { orders: { select: { id: true, status: true } } },
    });
    if (!order) throw new AppError(status.NOT_FOUND, "Order not found.");
    if (order.status !== OrderStatus.PAID) throw new AppError(status.BAD_REQUEST, "Only a paid order can be refunded.");

    for (const child of order.orders) {
        if (child.status === OrderStatus.PAID) await OrderService.refundOrder(child.id, reason);
    }
    logger.update("Bundle order refunded", { bundleOrderId, reason });
    return prisma.bundleOrder.update({
        where: { id: bundleOrderId },
        data: { status: OrderStatus.REFUNDED, failureReason: reason },
        include: bundleOrderInclude,
    });
};

export const BundleService = {
    getPublicBundles,
    getPublicBundle,
    createBundleOrder,
    getMyBundleOrder,
    submitBkashBundlePayment,
    listBundles,
    createBundle,
    updateBundle,
    deleteBundle,
    listBundleOrders,
    markBundlePaid,
    rejectBundleOrder,
    refundBundleOrder,
};
