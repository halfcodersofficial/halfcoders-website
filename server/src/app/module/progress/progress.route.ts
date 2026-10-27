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


export const ProgressRoutes = router;
