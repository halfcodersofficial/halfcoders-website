import { Router } from "express";
import { Role } from "../../lib/roles";
import { checkAuth } from "../../middleware/checkAuth";
import { LeaderboardController } from "./leaderboard.controller";

const router = Router();

const ADMINS = [Role.ADMIN, Role.SUPER_ADMIN] as const;

// The admin overview: every course with its standings rolled up, then one course's.
router.get("/manage/courses", checkAuth(...ADMINS), LeaderboardController.getLeaderboardCourses);
router.get("/manage/courses/:courseId", checkAuth(...ADMINS), LeaderboardController.getLeaderboardCourse);

// XP is earned by learning, so "my" here can only mean a student's.
router.get("/my-xp", checkAuth(Role.STUDENT), LeaderboardController.getMyXpHistory);
router.get(
    "/courses/:courseId/my-rank",
    checkAuth(Role.STUDENT),
    LeaderboardController.getMyRank,
);
// Board itself is public — it doubles as social proof on the course page.
router.get("/courses/:courseId", LeaderboardController.getCourseLeaderboard);

export const LeaderboardRoutes = router;
