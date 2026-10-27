import { Router } from "express";
import { Role } from "../../lib/roles";
import { trackActivity } from "../../lib/staffActivity";
import { checkAuth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { VideoController } from "./video.controller";
import {
    bulkCreateVideosZodSchema,
    bulkPublishVideosZodSchema,
    createVideoZodSchema,
    reorderVideosZodSchema,
    updateVideoZodSchema,
} from "./video.validation";

const router = Router();

const STAFF = [Role.MENTOR, Role.ADMIN, Role.SUPER_ADMIN] as const;

// Note: these are the *management* endpoints and always return the YouTube
// URL. Students read videos through /api/v1/learning, which checks enrolment
// before handing out a link.
router.get("/module/:moduleId", checkAuth(...STAFF), VideoController.getVideosByModule);

router.post("/", checkAuth(...STAFF), trackActivity("lesson.create"), validateRequest(createVideoZodSchema), VideoController.createVideo);

router.post(
    "/bulk",
    checkAuth(...STAFF),
    trackActivity("lesson.bulkCreate"),
    validateRequest(bulkCreateVideosZodSchema),
    VideoController.bulkCreateVideos,
);

router.patch(
    "/bulk/publish",
    checkAuth(...STAFF),
    trackActivity("lesson.bulkPublish"),
    validateRequest(bulkPublishVideosZodSchema),
    VideoController.bulkSetPublished,
);

router.patch(
    "/module/:moduleId/reorder",
    checkAuth(...STAFF),
    trackActivity("lesson.reorder"),
    validateRequest(reorderVideosZodSchema),
    VideoController.reorderVideos,
);

router.patch(
    "/:videoId",
    checkAuth(...STAFF),
    trackActivity("lesson.update"),
    validateRequest(updateVideoZodSchema),
    VideoController.updateVideo,
);

router.delete("/:videoId", checkAuth(...STAFF), trackActivity("lesson.delete"), VideoController.deleteVideo);

export const VideoRoutes = router;
