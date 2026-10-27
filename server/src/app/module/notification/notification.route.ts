import { Router } from "express";
import z from "zod";
import { NotificationType } from "../../../generated/prisma/enums";
import { Role } from "../../lib/roles";
import { checkAuth } from "../../middleware/checkAuth";
import { heavyOpsRateLimiter } from "../../middleware/rateLimiter";
import { validateRequest } from "../../middleware/validateRequest";
import { NotificationController } from "./notification.controller";

const router = Router();

const broadcastZodSchema = z
    .object({
        title: z.string().trim().min(3).max(160),
        message: z.string().trim().min(3).max(2000),
        type: z.enum(NotificationType).optional(),
        link: z.string().trim().max(500).optional(),
        audience: z.enum(["ALL_STUDENTS", "ALL_MENTORS", "COURSE"]),
        courseId: z.string().trim().min(1).optional(),
        showOnLogin: z.boolean().optional(),
        repeatOnLogin: z.boolean().optional(),
    })
    .refine((data) => data.audience !== "COURSE" || Boolean(data.courseId), {
        path: ["courseId"],
        message: "Choose a course to notify its students",
    });

router.get("/", checkAuth(), NotificationController.getMyNotifications);
router.get("/unread-count", checkAuth(), NotificationController.getUnreadCount);
router.get("/login-popups", checkAuth(), NotificationController.getLoginPopups);
router.patch("/read-all", checkAuth(), NotificationController.markAllAsRead);
router.patch("/:notificationId/read", checkAuth(), NotificationController.markAsRead);
router.patch("/:notificationId/unread", checkAuth(), NotificationController.markAsUnread);
// Before `/:notificationId`, which would otherwise take "read" for an id.
router.delete("/read", checkAuth(), NotificationController.deleteRead);
router.delete("/:notificationId", checkAuth(), NotificationController.deleteNotification);

// Read-only counts for the composer, so no heavy-ops limiter.
router.get(
    "/broadcast/audience",
    checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
    NotificationController.getBroadcastAudience,
);

router.get(
    "/broadcast/popups",
    checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
    NotificationController.getLivePopups,
);

// One update across every row the pop-up was sent with — as heavy as the send.
router.patch(
    "/broadcast/popups/:notificationId/stop",
    checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
    heavyOpsRateLimiter,
    NotificationController.stopPopup,
);

// A broadcast can write tens of thousands of rows, so it gets the heavy-ops
// limiter on top of the admin-only role check.
router.post(
    "/broadcast",
    checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
    heavyOpsRateLimiter,
    validateRequest(broadcastZodSchema),
    NotificationController.broadcast,
);

export const NotificationRoutes = router;
