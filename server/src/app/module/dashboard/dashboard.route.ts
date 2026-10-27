import { Router } from "express";
import { Role } from "../../lib/roles";
import { checkAuth } from "../../middleware/checkAuth";
import { DashboardController } from "./dashboard.controller";

const router = Router();

/**
 * One dashboard per role, and each one only answers to that role.
 *
 * These are the three consoles, and none of them is a superset of another: the
 * student view is built from enrolments, the mentor view from the courses you
 * are assigned to, the admin view from platform totals. A staff account calling
 * `/student` used to get a valid, empty dashboard — no data leaked, but the
 * client could render a learning home for someone with nothing to learn. The
 * shared, course-scoped tooling both staff consoles use lives on its own routes
 * (`/courses/staff/:courseId`, `/milestones`, `/videos`, …) and is gated on the
 * staff pair there.
 */
router.get("/student", checkAuth(Role.STUDENT), DashboardController.getStudentDashboard);

router.get("/mentor", checkAuth(Role.MENTOR), DashboardController.getMentorDashboard);

router.get(
    "/admin",
    checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
    DashboardController.getAdminDashboard,
);

export const DashboardRoutes = router;
