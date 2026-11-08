import { Router } from "express";
import z from "zod";
import { Role } from "../../lib/roles";
import { checkAuth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { ProgressController } from "./progress.controller";

const router = Router();

const watchPositionZodSchema = z.object({
    watchedSeconds: z.number().int().min(0).max(24 * 3600),
});

const videoDurationZodSchema = z.object({
    seconds: z.number().positive().max(24 * 3600),
});

const videoDurationsZodSchema = z.object({
    durations: z
        .array(z.object({ videoId: z.string().min(1).max(64), seconds: z.number().positive().max(24 * 3600) }))
        .min(1)
        .max(200),
});

// Progress is recorded against an enrolment, which only a student holds. The
// service resolves that enrolment and rejects a student who doesn't have one.
router.post(
    "/videos/:videoId/complete",
    checkAuth(Role.STUDENT),
    ProgressController.markVideoComplete,
);
router.post(
    "/videos/:videoId/incomplete",
    checkAuth(Role.STUDENT),
    ProgressController.markVideoIncomplete,
);

router.patch(
    "/videos/:videoId/position",
    checkAuth(Role.STUDENT),
    validateRequest(watchPositionZodSchema),
    ProgressController.updateWatchPosition,
);

// Lesson running times measured in the browser, for lessons stored without
// one: the whole course in one go when it opens (batched, so a long course
// stays well inside the rate limit), or the open lesson's own player. Staff
// previewing a course count too — the service checks course access.
router.patch(
    "/durations",
    checkAuth(Role.STUDENT, Role.MENTOR, Role.ADMIN, Role.SUPER_ADMIN),
    validateRequest(videoDurationsZodSchema),
    ProgressController.reportVideoDurations,
);
router.patch(
    "/videos/:videoId/duration",
    checkAuth(Role.STUDENT, Role.MENTOR, Role.ADMIN, Role.SUPER_ADMIN),
    validateRequest(videoDurationZodSchema),
    ProgressController.reportVideoDuration,
);


export const ProgressRoutes = router;
