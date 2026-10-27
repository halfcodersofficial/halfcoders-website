import { Router } from "express";
import { Role } from "../../lib/roles";
import { checkAuth } from "../../middleware/checkAuth";
import { LearningController } from "./learning.controller";

const router = Router();

/**
 * The learning player, students only.
 *
 * Enrolment is still checked inside the service — a student who hasn't bought
 * the course gets a 403 telling them to enrol — but the role check comes first
 * so staff never reach it. They have no place in a screen that records progress
 * against an enrolment they don't have; the curriculum editor is where they
 * review content, and `/courses/:slug` is where they see the public face of it.
 */
router.get("/courses/:slug", checkAuth(Role.STUDENT), LearningController.getCourseLearning);
router.get("/videos/:videoId", checkAuth(Role.STUDENT), LearningController.getVideo);
// The planned outline (plan: separate from the pre-enrolment roadmap PDF and
// from the real modules) — the Outline Maker's weeks and dated items.
router.get("/courses/:slug/outline", checkAuth(Role.STUDENT), LearningController.getCourseOutline);

export const LearningRoutes = router;
