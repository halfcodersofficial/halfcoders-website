import { Router } from "express";
import z from "zod";
import { Role } from "../../lib/roles";
import { checkAuth } from "../../middleware/checkAuth";
import { heavyOpsRateLimiter } from "../../middleware/rateLimiter";
import { validateRequest } from "../../middleware/validateRequest";
import { EnrollmentController } from "./enrollment.controller";

const router = Router();

const ADMINS = [Role.ADMIN, Role.SUPER_ADMIN] as const;

const manualEnrollZodSchema = z.object({
    studentId: z.string().trim().min(1, "Student is required"),
    courseId: z.string().trim().min(1, "Course is required"),
});

// Admin routes first — "manage" must not be captured by "/:courseId".
router.get("/manage", checkAuth(...ADMINS), EnrollmentController.getAllEnrollments);
// The same list as a CSV download.
router.get("/manage/export", checkAuth(...ADMINS), heavyOpsRateLimiter, EnrollmentController.exportEnrollments);
router.get("/manage/courses", checkAuth(...ADMINS), EnrollmentController.getEnrollmentCourses);
router.get("/manage/courses/:courseId", checkAuth(...ADMINS), EnrollmentController.getEnrollmentCourse);

router.post(
    "/manage",
    checkAuth(...ADMINS),
    validateRequest(manualEnrollZodSchema),
    EnrollmentController.enrollStudentManually,
);

router.patch(
    "/manage/:enrollmentId/cancel",
    checkAuth(...ADMINS),
    EnrollmentController.cancelEnrollment,
);

router.patch(
    "/manage/:enrollmentId/reactivate",
    checkAuth(...ADMINS),
    EnrollmentController.reactivateEnrollment,
);

// Admins: the students on one course, with their contact details and
// progress. Not mentors — they see how many are enrolled (the course and
// dashboard counts) and a student's name only where they mark their work
// (lib/studentPrivacy).
router.get(
    "/course/:courseId",
    checkAuth(...ADMINS),
    EnrollmentController.getCourseStudents,
);

// Students: their own enrolments. Staff hold none by definition, and the
// admin console reads the same rows through `/manage`.
router.get("/my", checkAuth(Role.STUDENT), EnrollmentController.getMyEnrollments);
router.get("/my/:courseId", checkAuth(Role.STUDENT), EnrollmentController.getMyEnrollment);

export const EnrollmentRoutes = router;
