import { Router } from "express";
import { Role } from "../../lib/roles";
import { checkAuth } from "../../middleware/checkAuth";
import { optionalAuth } from "../../middleware/optionalAuth";
import { checkoutRateLimiter } from "../../middleware/rateLimiter";
import { validateRequest } from "../../middleware/validateRequest";
import { bkashSubmissionZodSchema } from "../../utils/bkash";
import { BundleController } from "./bundle.controller";
import { createBundleZodSchema, refundBundleZodSchema, updateBundleZodSchema } from "./bundle.validation";

const router = Router();

const ADMINS = [Role.ADMIN, Role.SUPER_ADMIN] as const;

// Admin routes first, so "manage" and "orders" aren't taken for a slug.
router.get("/manage", checkAuth(...ADMINS), BundleController.listBundles);
router.post("/manage", checkAuth(...ADMINS), validateRequest(createBundleZodSchema), BundleController.createBundle);
router.patch("/manage/:bundleId", checkAuth(...ADMINS), validateRequest(updateBundleZodSchema), BundleController.updateBundle);
router.delete("/manage/:bundleId", checkAuth(...ADMINS), BundleController.deleteBundle);
router.get("/manage/:bundleId/orders", checkAuth(...ADMINS), BundleController.listBundleOrders);
router.patch("/manage/orders/:bundleOrderId/paid", checkAuth(...ADMINS), BundleController.markBundlePaid);
router.patch(
    "/manage/orders/:bundleOrderId/failed",
    checkAuth(...ADMINS),
    validateRequest(refundBundleZodSchema),
    BundleController.rejectBundleOrder,
);
router.patch(
    "/manage/orders/:bundleOrderId/refund",
    checkAuth(...ADMINS),
    validateRequest(refundBundleZodSchema),
    BundleController.refundBundleOrder,
);

// A student's bundle checkout: start it (priced on the server), read it, and
// send in the bKash payment for an admin to verify.
router.post("/:bundleId/orders", checkAuth(Role.STUDENT), checkoutRateLimiter, BundleController.createBundleOrder);
router.get("/orders/:bundleOrderId", checkAuth(Role.STUDENT), BundleController.getMyBundleOrder);
router.post(
    "/orders/:bundleOrderId/bkash",
    checkAuth(Role.STUDENT),
    checkoutRateLimiter,
    validateRequest(bkashSubmissionZodSchema),
    BundleController.submitBkashBundlePayment,
);

// Public — priced for the viewer when they're signed in.
router.get("/", optionalAuth, BundleController.getPublicBundles);
router.get("/:slug", optionalAuth, BundleController.getPublicBundle);

export const BundleRoutes = router;
