import { Router } from "express";
import { Role } from "../../lib/roles";
import { checkAuth } from "../../middleware/checkAuth";
import { optionalAuth } from "../../middleware/optionalAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { PromotionController } from "./promotion.controller";
import {
    giveRewardCoursesZodSchema,
    saveOfferZodSchema,
    saveRewardZodSchema,
    setRewardForEveryoneZodSchema,
} from "./promotion.validation";

const router = Router();

const ADMINS = [Role.ADMIN, Role.SUPER_ADMIN] as const;

// Admins set up each course's offer and reward from that course's page.
router.get("/manage/courses", checkAuth(...ADMINS), PromotionController.getPromotionCourses);
router.get("/manage/courses/:courseId", checkAuth(...ADMINS), PromotionController.getPromotionCourse);
router.put("/manage/courses/:courseId/offer", checkAuth(...ADMINS), validateRequest(saveOfferZodSchema), PromotionController.saveOffer);
router.delete("/manage/courses/:courseId/offer", checkAuth(...ADMINS), PromotionController.deleteOffer);
router.put("/manage/courses/:courseId/reward", checkAuth(...ADMINS), validateRequest(saveRewardZodSchema), PromotionController.saveReward);
router.delete("/manage/courses/:courseId/reward", checkAuth(...ADMINS), PromotionController.deleteReward);

// Reward courses given with a course — to one student, a group, or everyone who has it.
router.post(
    "/manage/courses/:courseId/reward-courses",
    checkAuth(...ADMINS),
    validateRequest(giveRewardCoursesZodSchema),
    PromotionController.giveRewardCourses,
);
router.patch(
    "/manage/reward-courses/:bonusId",
    checkAuth(...ADMINS),
    validateRequest(setRewardForEveryoneZodSchema),
    PromotionController.setRewardForEveryone,
);
router.delete("/manage/reward-courses/:bonusId", checkAuth(...ADMINS), PromotionController.removeRewardCourse);
router.delete("/manage/reward-courses/:bonusId/students/:studentId", checkAuth(...ADMINS), PromotionController.takeBackRewardCourse);

// The course page and checkout — with the viewer's own reward deadline when signed in.
router.get("/courses/:courseId", optionalAuth, PromotionController.getCoursePromotions);

export const PromotionRoutes = router;
