import { Router } from "express";
import { Role } from "../../lib/roles";
import { trackActivity } from "../../lib/staffActivity";
import { checkAuth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { AnnouncementController } from "./announcement.controller";
import { createAnnouncementZodSchema, updateAnnouncementZodSchema } from "./announcement.validation";

const router = Router();

const STAFF = [Role.MENTOR, Role.ADMIN, Role.SUPER_ADMIN] as const;

// A course's board: its staff, and students who can open the course (checked in the service).
router.get("/course/:courseId", checkAuth(), AnnouncementController.listForCourse);
router.get("/learn/:slug", checkAuth(Role.STUDENT), AnnouncementController.listForCourseSlug);

router.post(
    "/course/:courseId",
    checkAuth(...STAFF),
    trackActivity("announcement.create"),
    validateRequest(createAnnouncementZodSchema),
    AnnouncementController.create,
);
router.patch(
    "/:announcementId",
    checkAuth(...STAFF),
    trackActivity("announcement.update"),
    validateRequest(updateAnnouncementZodSchema),
    AnnouncementController.update,
);
router.delete("/:announcementId", checkAuth(...STAFF), trackActivity("announcement.delete"), AnnouncementController.remove);

export const AnnouncementRoutes = router;
