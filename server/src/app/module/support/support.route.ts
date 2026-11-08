import { Router } from "express";
import z from "zod";
import { SupportSessionStatus } from "../../../generated/prisma/enums";
import { Role } from "../../lib/roles";
import { trackActivity } from "../../lib/staffActivity";
import { checkAuth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { SupportController } from "./support.controller";
import {
    createSessionZodSchema,
    joinQueueZodSchema,
    mentorNoteZodSchema,
    queueStatusZodSchema,
    supportFeedbackZodSchema,
    updateSessionZodSchema,
} from "./support.validation";

const router = Router();

const STAFF = [Role.MENTOR, Role.ADMIN, Role.SUPER_ADMIN] as const;
const ADMINS = [Role.ADMIN, Role.SUPER_ADMIN] as const;

const sessionStatusZodSchema = z.object({
    status: z.enum(SupportSessionStatus),
});

// ---- Mentor / admin. Declared before the student routes so literal segments
// aren't captured by "/:sessionId".
// The admin overview: every course with its sessions rolled up, then one course's.
router.get("/manage/defaults", checkAuth(...STAFF), SupportController.getDefaults);
// The sessions you hosted that are over, newest first, with how each line went.
router.get("/manage/mine/past", checkAuth(...STAFF), SupportController.getMyPastSessions);
router.get("/manage/courses", checkAuth(...ADMINS), SupportController.getSupportCourses);
router.get("/manage/courses/:courseId", checkAuth(...ADMINS), SupportController.getSupportCourse);
router.get("/manage/course/:courseId", checkAuth(...STAFF), SupportController.getSessionsByCourse);

router.post(
    "/manage",
    checkAuth(...STAFF),
    trackActivity("support.create"),
    validateRequest(createSessionZodSchema),
    SupportController.createSession,
);

router.patch(
    "/manage/:sessionId",
    checkAuth(...STAFF),
    trackActivity("support.update"),
    validateRequest(updateSessionZodSchema),
    SupportController.updateSession,
);

router.patch(
    "/manage/:sessionId/status",
    checkAuth(...STAFF),
    trackActivity("support.status"),
    validateRequest(sessionStatusZodSchema),
    SupportController.setSessionStatus,
);

router.delete("/manage/:sessionId", checkAuth(...STAFF), trackActivity("support.delete"), SupportController.deleteSession);

// The mentor's live queue board and its controls (plan §26). `serve-next`
// completes the current student and promotes the next serial — the queue is
// advanced by hand, never on a timer.
router.get("/manage/:sessionId/queue", checkAuth(...STAFF), SupportController.getQueue);
router.get("/manage/:sessionId/history", checkAuth(...STAFF), SupportController.getSessionHistory);

router.post(
    "/manage/:sessionId/serve-next",
    checkAuth(...STAFF),
    trackActivity("support.serveNext"),
    validateRequest(mentorNoteZodSchema),
    SupportController.serveNext,
);

router.post(
    "/manage/:sessionId/complete",
    checkAuth(...STAFF),
    trackActivity("support.complete"),
    validateRequest(mentorNoteZodSchema),
    SupportController.completeCurrent,
);

router.post(
    "/manage/queue/:queueId/skip",
    checkAuth(...STAFF),
    trackActivity("support.skip"),
    validateRequest(mentorNoteZodSchema),
    SupportController.skipStudent,
);

// Any turn moved by hand — call, helped, skipped, left, back in line.
router.patch(
    "/manage/queue/:queueId/status",
    checkAuth(...STAFF),
    trackActivity("support.queueStatus"),
    validateRequest(queueStatusZodSchema),
    SupportController.setQueueStatus,
);

// ---- Student. Joining a queue is something you do as a learner on a course
// you're enrolled in; the mentor's side of the same session is above.

// A finished turn is rated before the next number (`joinQueue` holds to it).
router.get("/feedback/pending", checkAuth(Role.STUDENT), SupportController.getPendingFeedback);
router.post(
    "/feedback/:queueId",
    checkAuth(Role.STUDENT),
    validateRequest(supportFeedbackZodSchema),
    SupportController.submitFeedback,
);

router.get(
    "/course/:courseId",
    checkAuth(Role.STUDENT),
    SupportController.getSessionsForStudent,
);
router.get(
    "/:sessionId/my-position",
    checkAuth(Role.STUDENT),
    SupportController.getMyQueuePosition,
);
// The public board (names only), for the first paint and when the socket is down.
router.get("/:sessionId/board", checkAuth(Role.STUDENT), SupportController.getBoardForStudent);

router.post(
    "/:sessionId/join",
    checkAuth(Role.STUDENT),
    validateRequest(joinQueueZodSchema),
    SupportController.joinQueue,
);

router.post("/:sessionId/leave", checkAuth(Role.STUDENT), SupportController.leaveQueue);

export const SupportRoutes = router;
