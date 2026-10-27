import status from "http-status";
import { Prisma } from "../../../generated/prisma/client";
import { NotificationType, OrderStatus, RefundRequestStatus } from "../../../generated/prisma/enums";
import AppError from "../../errorHelpers/AppError";
import { IQueryParams } from "../../interfaces/query.interface";
import { IRequestUser } from "../../interfaces/requestUser.interface";
import { prisma } from "../../lib/prisma";
import { QueryBuilder } from "../../utils/QueryBuilder";
import { createNotification, notifyAdmins } from "../notification/notification.service";
import { OrderService } from "../order/order.service";

/** The refund policy's window: a request within 48 hours of paying. */
export const REFUND_WINDOW_HOURS = 48;
const HOUR = 3_600_000;

const orderSelect = {
    id: true, orderNumber: true, total: true, currency: true, status: true, createdAt: true, courseId: true,
    course: { select: { id: true, title: true, slug: true } },
    payment: { select: { paidAt: true, gateway: true } },
} satisfies Prisma.OrderSelect;

/** When the order was paid — the clock the 48 hours run on. */
const paidAtOf = (order: { createdAt: Date; payment: { paidAt: Date | null } | null }) => order.payment?.paidAt ?? order.createdAt;

/**
 * A student asks for their money back on a paid order, within the policy's
 * 48 hours. One open request per order; admins are told.
 */
const request = async (user: IRequestUser, payload: { orderId: string; reason: string }) => {
    const order = await prisma.order.findFirst({ where: { id: payload.orderId, studentId: user.userId }, select: orderSelect });
    if (!order) throw new AppError(status.NOT_FOUND, "Order not found.");
    if (order.status !== OrderStatus.PAID) throw new AppError(status.BAD_REQUEST, "Only a paid order can be refunded.");
    if (order.total <= 0) throw new AppError(status.BAD_REQUEST, "Nothing was paid for this order, so there's nothing to refund.");
    if (Date.now() - paidAtOf(order).getTime() > REFUND_WINDOW_HOURS * HOUR) {
        throw new AppError(status.BAD_REQUEST, `Refunds can be asked for within ${REFUND_WINDOW_HOURS} hours of paying — this order is past that.`);
    }
    const open = await prisma.refundRequest.findFirst({ where: { orderId: order.id, status: RefundRequestStatus.PENDING }, select: { id: true } });
    if (open) throw new AppError(status.CONFLICT, "You've already asked for a refund on this order — we'll be in touch.");

    const created = await prisma.refundRequest.create({
        data: { orderId: order.id, studentId: user.userId, reason: payload.reason },
        include: { order: { select: orderSelect } },
    });
    await notifyAdmins({
        title: `Refund requested: ${order.orderNumber}`,
        message: `${order.course.title} · ${order.currency} ${order.total} — “${payload.reason.slice(0, 160)}”`,
        type: NotificationType.PAYMENT,
        link: "/admin/refunds",
        senderId: user.userId,
    });
    return created;
};

/** A student's own requests, newest first. */
const mine = (user: IRequestUser) =>
    prisma.refundRequest.findMany({
        where: { studentId: user.userId },
        orderBy: { createdAt: "desc" },
        include: { order: { select: orderSelect } },
    });

/** Takes back a request that's still waiting. */
const withdraw = async (user: IRequestUser, requestId: string) => {
    const found = await prisma.refundRequest.findFirst({ where: { id: requestId, studentId: user.userId }, select: { status: true } });
    if (!found) throw new AppError(status.NOT_FOUND, "Request not found.");
    if (found.status !== RefundRequestStatus.PENDING) throw new AppError(status.CONFLICT, "This request has already been decided.");
    return prisma.refundRequest.update({ where: { id: requestId }, data: { status: RefundRequestStatus.WITHDRAWN } });
};

/** The admins' queue, by status (waiting first, oldest first). */
const list = (query: IQueryParams) =>
    new QueryBuilder(prisma.refundRequest, { sortOrder: query.status === "PENDING" ? "asc" : "desc", ...query }, {
        searchableFields: ["reason", "order.orderNumber", "student.name", "student.email"],
        filterableFields: ["status"],
        maxLimit: 100,
    })
        .search()
        .filter()
        .sort()
        .paginate()
        .include({
            student: { select: { id: true, name: true, email: true, phone: true, image: true } },
            order: { select: orderSelect },
            decidedBy: { select: { id: true, name: true } },
        } satisfies Prisma.RefundRequestInclude)
        .execute();

const counts = async () => {
    const rows = await prisma.refundRequest.groupBy({ by: ["status"], _count: { _all: true } });
    const result: Record<RefundRequestStatus, number> = { PENDING: 0, APPROVED: 0, DECLINED: 0, WITHDRAWN: 0 };
    for (const row of rows) result[row.status] = row._count._all;
    return result;
};

/**
 * An admin's decision. Approving refunds the order — access to the course
 * ends, learning history stays — and the student is told either way (by
 * email too), with the note.
 */
const decide = async (user: IRequestUser, requestId: string, payload: { decision: "APPROVE" | "DECLINE"; note?: string }) => {
    const found = await prisma.refundRequest.findUnique({ where: { id: requestId }, include: { order: { select: orderSelect } } });
    if (!found) throw new AppError(status.NOT_FOUND, "Request not found.");
    if (found.status !== RefundRequestStatus.PENDING) throw new AppError(status.CONFLICT, "This request has already been decided.");

    const approve = payload.decision === "APPROVE";
    if (approve) await OrderService.refundOrder(found.orderId, payload.note || `Refund request ${found.id}`);

    const decided = await prisma.refundRequest.update({
        where: { id: requestId },
        data: {
            status: approve ? RefundRequestStatus.APPROVED : RefundRequestStatus.DECLINED,
            adminNote: payload.note || null,
            decidedById: user.userId,
            decidedAt: new Date(),
        },
    });
    await createNotification({
        userId: found.studentId,
        title: approve ? `Refund approved: ${found.order.orderNumber}` : `Refund declined: ${found.order.orderNumber}`,
        message: approve
            ? `We're refunding ${found.order.currency} ${found.order.total} for ${found.order.course.title}. It can take 7–65 days to reach you, and your access to the course has ended.${payload.note ? ` ${payload.note}` : ""}`
            : `Your refund request for ${found.order.course.title} wasn't approved: ${payload.note}`,
        type: NotificationType.PAYMENT,
        link: "/dashboard/profile/order-history",
        senderId: user.userId,
        email: { actionLabel: "See your orders" },
    });
    return decided;
};

export const RefundRequestService = { request, mine, withdraw, list, counts, decide };
