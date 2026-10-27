import { Router } from "express";
import { Role } from "../../lib/roles";
import { checkAuth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { RefundRequestController } from "./refundRequest.controller";
import { decideRefundZodSchema, requestRefundZodSchema } from "./refundRequest.validation";

const router = Router();

const ADMINS = [Role.ADMIN, Role.SUPER_ADMIN] as const;

// Admins: the queue, and the decision.
router.get("/manage", checkAuth(...ADMINS), RefundRequestController.list);
router.get("/manage/counts", checkAuth(...ADMINS), RefundRequestController.counts);
router.patch("/manage/:requestId", checkAuth(...ADMINS), validateRequest(decideRefundZodSchema), RefundRequestController.decide);

// Students: ask, see, take back.
router.post("/", checkAuth(Role.STUDENT), validateRequest(requestRefundZodSchema), RefundRequestController.request);
router.get("/mine", checkAuth(Role.STUDENT), RefundRequestController.mine);
router.post("/:requestId/withdraw", checkAuth(Role.STUDENT), RefundRequestController.withdraw);

export const RefundRequestRoutes = router;
