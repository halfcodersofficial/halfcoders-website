import { Router } from "express";
import { Role } from "../../lib/roles";
import { checkAuth } from "../../middleware/checkAuth";
import { optionalAuth } from "../../middleware/optionalAuth";
import { heavyOpsRateLimiter } from "../../middleware/rateLimiter";
import { validateQuery, validateRequest } from "../../middleware/validateRequest";
import { CouponController } from "./coupon.controller";
import { checkCouponQuerySchema, createCouponZodSchema, updateCouponZodSchema } from "./coupon.validation";

const router = Router();

const ADMINS = [Role.ADMIN, Role.SUPER_ADMIN] as const;

// Anyone holding a code (a share link, the course page) can ask what it does;
// a signed-in student's own uses are counted too.
router.get("/check", optionalAuth, validateQuery(checkCouponQuerySchema), CouponController.check);

// Admins make and manage codes; students apply one on their order (`/orders/:orderId/coupon`).
router.get("/manage", checkAuth(...ADMINS), CouponController.list);
router.post("/manage", checkAuth(...ADMINS), validateRequest(createCouponZodSchema), CouponController.create);
router.get("/manage/:couponId", checkAuth(...ADMINS), CouponController.detail);
router.get("/manage/:couponId/export", checkAuth(...ADMINS), heavyOpsRateLimiter, CouponController.exportRedemptions);
router.patch("/manage/:couponId", checkAuth(...ADMINS), validateRequest(updateCouponZodSchema), CouponController.update);
router.delete("/manage/:couponId", checkAuth(...ADMINS), CouponController.remove);

export const CouponRoutes = router;
