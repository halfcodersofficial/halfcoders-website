import { Router } from "express";
import { multerMemoryUpload, verifyFileSignatures } from "../../config/multer.config";
import { Role } from "../../lib/roles";
import { checkAuth } from "../../middleware/checkAuth";
import { heavyOpsRateLimiter } from "../../middleware/rateLimiter";
import { authRateLimiter } from "../../middleware/rateLimiter";
import { validateRequest } from "../../middleware/validateRequest";
import { UserController } from "./user.controller";
import {
    changeUserRoleZodSchema,
    changeUserStatusZodSchema,
    createAdminZodSchema,
    createMentorZodSchema,
    updateMentorZodSchema,
} from "./user.validation";

const router = Router();

const ADMINS = [Role.ADMIN, Role.SUPER_ADMIN] as const;

// Public — the "Mentors" section of the marketing site.
router.get("/mentors/public", UserController.getPublicMentors);

// Student management. "counts" must not be captured by "/:userId".
router.get("/students", checkAuth(...ADMINS), UserController.getStudents);
// The same register as a CSV download. Before `/students/:userId`, which would take "export".
router.get("/students/export", checkAuth(...ADMINS), heavyOpsRateLimiter, UserController.exportStudents);
router.get("/students/counts", checkAuth(...ADMINS), UserController.getStudentCounts);
router.get("/students/:userId", checkAuth(...ADMINS), UserController.getStudentById);

// The student detail page: everything about them, and one course week by week.
router.get("/students/:userId/overview", checkAuth(...ADMINS), UserController.getStudentOverview);
router.get("/students/:userId/courses/:courseId", checkAuth(...ADMINS), UserController.getStudentCourse);

// Mentor management
router.get("/mentors", checkAuth(...ADMINS), UserController.getMentors);
router.get("/mentors/:mentorId", checkAuth(...ADMINS), UserController.getMentorById);

// The mentor detail page: numbers and recent work, the change history, and
// the devices they're signed in on.
router.get("/mentors/:mentorId/overview", checkAuth(...ADMINS), UserController.getMentorOverview);
router.get("/mentors/:mentorId/activity", checkAuth(...ADMINS), UserController.getMentorActivity);
router.get("/mentors/:mentorId/reviews", checkAuth(...ADMINS), UserController.getMentorReviews);
router.get("/mentors/:mentorId/devices", checkAuth(...ADMINS), UserController.getMentorDevices);

router.post(
    "/mentors",
    checkAuth(...ADMINS),
    validateRequest(createMentorZodSchema),
    UserController.createMentor,
);

router.patch(
    "/mentors/:mentorId",
    checkAuth(...ADMINS),
    validateRequest(updateMentorZodSchema),
    UserController.updateMentor,
);

// The mentor's shared profile photo — their own, or a default avatar the
// admin console renders to an image. Cropped to a square JPEG in the browser.
router.patch(
    "/mentors/:mentorId/photo",
    checkAuth(...ADMINS),
    multerMemoryUpload.single("photo"),
    verifyFileSignatures,
    UserController.updateMentorPhoto,
);

// Admin directory: a super admin adds admins, and suspends or restores their access.
router.get("/admins", checkAuth(Role.SUPER_ADMIN), UserController.getAdmins);

// A super admin adds an admin, on a temporary password.
router.post("/admins", checkAuth(Role.SUPER_ADMIN), validateRequest(createAdminZodSchema), UserController.createAdmin);

router.patch(
    "/:userId/status",
    checkAuth(...ADMINS),
    validateRequest(changeUserStatusZodSchema),
    UserController.changeUserStatus,
);

router.patch(
    "/:userId/role",
    checkAuth(...ADMINS),
    validateRequest(changeUserRoleZodSchema),
    UserController.changeUserRole,
);

// Credential recovery: emails the person a single-use link to choose a new
// password (the identity service sends it). Behind the strict
// limiter: it's as credential-sensitive as any password endpoint.
router.patch(
    "/:userId/reset-password",
    checkAuth(...ADMINS),
    authRateLimiter,
    UserController.resetUserPassword,
);

export const UserRoutes = router;
