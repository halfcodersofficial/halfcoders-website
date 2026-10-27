import { Router } from "express";
import { Role } from "../../lib/roles";
import { checkAuth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { CourseReviewController } from "./courseReview.controller";
import { moderateReviewZodSchema, upsertReviewZodSchema } from "./courseReview.validation";

const router = Router();

const STAFF = [Role.MENTOR, Role.ADMIN, Role.SUPER_ADMIN] as const;
const ADMINS = [Role.ADMIN, Role.SUPER_ADMIN] as const;

// Public: a course page's published reviews.
router.get("/public/:slug", CourseReviewController.getPublic);

// Admins: moderation.
router.get("/manage", checkAuth(...ADMINS), CourseReviewController.getForAdmin);
router.get("/manage/counts", checkAuth(...ADMINS), CourseReviewController.getCounts);
router.patch("/manage/:reviewId", checkAuth(...ADMINS), validateRequest(moderateReviewZodSchema), CourseReviewController.moderate);

// A course's staff: every review of it, students by name only.
router.get("/course/:courseId", checkAuth(...STAFF), CourseReviewController.getForStaff);

// Students: their own review of a course they're on.
router.get("/mine/:courseId", checkAuth(Role.STUDENT), CourseReviewController.getMine);
router.put("/mine/:courseId", checkAuth(Role.STUDENT), validateRequest(upsertReviewZodSchema), CourseReviewController.upsert);
router.delete("/mine/:courseId", checkAuth(Role.STUDENT), CourseReviewController.removeMine);

export const CourseReviewRoutes = router;
