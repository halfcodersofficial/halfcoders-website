import { Router } from "express";
import z from "zod";
import { PaymentGateway } from "../../../generated/prisma/enums";
import { Role } from "../../lib/roles";
import { checkAuth } from "../../middleware/checkAuth";
import { checkoutRateLimiter, heavyOpsRateLimiter } from "../../middleware/rateLimiter";
import { validateRequest } from "../../middleware/validateRequest";
import { bkashSubmissionZodSchema } from "../../utils/bkash";
import { applyCouponZodSchema } from "../coupon/coupon.validation";
import { OrderController } from "./order.controller";

const router = Router();

const ADMINS = [Role.ADMIN, Role.SUPER_ADMIN] as const;

// Only the course is supplied — the price comes from the database, never from
// the client.
const createOrderZodSchema = z.object({
    courseId: z.string().trim().min(1, "Course is required"),
});

const markPaidZodSchema = z.object({
    gateway: z.enum(PaymentGateway).default(PaymentGateway.MANUAL),
    transactionId: z.string().trim().max(120).optional(),
    gatewayData: z.record(z.string(), z.unknown()).optional(),
});

const reasonZodSchema = z.object({
    reason: z.string().trim().max(500).optional(),
});

// Admin routes first so "manage" isn't captured by "/:orderId".
router.get("/manage", checkAuth(...ADMINS), OrderController.getAllOrders);
// The same list as a CSV download.
router.get("/manage/export", checkAuth(...ADMINS), heavyOpsRateLimiter, OrderController.exportOrders);
router.get("/manage/courses", checkAuth(...ADMINS), OrderController.getOrderCourses);
router.get("/manage/courses/:courseId", checkAuth(...ADMINS), OrderController.getOrderCourse);

router.patch(
    "/manage/:orderId/paid",
    checkAuth(...ADMINS),
    validateRequest(markPaidZodSchema),
    OrderController.markOrderPaid,
);

router.patch(
    "/manage/:orderId/failed",
    checkAuth(...ADMINS),
    validateRequest(reasonZodSchema),
    OrderController.markOrderFailed,
);

router.patch(
    "/manage/:orderId/refund",
    checkAuth(...ADMINS),
    validateRequest(reasonZodSchema),
    OrderController.refundOrder,
);

// Buying a course is a student action. Staff who need someone enrolled use
// the manual enrolment on `/enrollments/manage`, which leaves an admin trail.
router.post(
    "/",
    checkAuth(Role.STUDENT),
    checkoutRateLimiter,
    validateRequest(createOrderZodSchema),
    OrderController.createOrder,
);

// A coupon on the student's own unpaid order: apply one, or take it off.
router.post("/:orderId/coupon", checkAuth(Role.STUDENT), checkoutRateLimiter, validateRequest(applyCouponZodSchema), OrderController.applyCoupon);
router.delete("/:orderId/coupon", checkAuth(Role.STUDENT), OrderController.removeCoupon);

// Paid by bKash: the transaction ID and sender number, for an admin to verify.
router.post(
    "/:orderId/bkash",
    checkAuth(Role.STUDENT),
    checkoutRateLimiter,
    validateRequest(bkashSubmissionZodSchema),
    OrderController.submitBkashPayment,
);

router.get("/my", checkAuth(Role.STUDENT), OrderController.getMyOrders);
router.get("/my/:orderId", checkAuth(Role.STUDENT), OrderController.getMyOrder);
router.get(
    "/my/:orderId/invoice",
    checkAuth(Role.STUDENT),
    heavyOpsRateLimiter,
    OrderController.downloadMyInvoice,
);

export const OrderRoutes = router;
