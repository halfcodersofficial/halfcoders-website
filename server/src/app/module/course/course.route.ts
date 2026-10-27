import { Router } from "express";
import { Role } from "../../lib/roles";
import { multerMemoryUpload, verifyFileSignatures } from "../../config/multer.config";
import { trackActivity } from "../../lib/staffActivity";
import { checkAuth } from "../../middleware/checkAuth";
import { optionalAuth } from "../../middleware/optionalAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { CourseController } from "./course.controller";
import {
    assignMentorZodSchema,
    changeCourseStatusZodSchema,
    courseContentZodSchema,
    createCourseZodSchema,
    updateCourseZodSchema,
} from "./course.validation";

const router = Router();

const ADMINS = [Role.ADMIN, Role.SUPER_ADMIN] as const;
const STAFF = [Role.MENTOR, Role.ADMIN, Role.SUPER_ADMIN] as const;

// ---------------------------------------------------------------------------
// Admin routes. Declared before the public `/:slug` route so literal segments
// like "manage" are never swallowed by the slug parameter.
// ---------------------------------------------------------------------------
router.get("/manage", checkAuth(...ADMINS), CourseController.getAdminCourses);

router.post(
    "/manage",
    checkAuth(...ADMINS),
    validateRequest(createCourseZodSchema),
    CourseController.createCourse,
);

router.get("/manage/:courseId", checkAuth(...ADMINS), CourseController.getCourseById);

router.patch(
    "/manage/:courseId",
    checkAuth(...ADMINS),
    validateRequest(updateCourseZodSchema),
    CourseController.updateCourse,
);

router.patch(
    "/manage/:courseId/status",
    checkAuth(...ADMINS),
    validateRequest(changeCourseStatusZodSchema),
    CourseController.changeCourseStatus,
);

router.delete("/manage/:courseId", checkAuth(...ADMINS), CourseController.deleteCourse);

router.post(
    "/manage/:courseId/mentors",
    checkAuth(...ADMINS),
    validateRequest(assignMentorZodSchema),
    CourseController.assignMentor,
);

router.delete(
    "/manage/:courseId/mentors/:mentorId",
    checkAuth(...ADMINS),
    CourseController.removeMentor,
);

// The pre-enrolment roadmap PDF (plan: "two separate curriculum systems").
// Staff, not admin-only — a mentor manages it for their own assigned courses
// (scoped by `assertCanManageCourse` in the service), an admin for any course.
// Deliberately not routed through `updateCourse`/`updateCourseContent` — those
// take a validated JSON body, this one a multipart file. Uploaded as a
// *private* Cloudinary asset (see `uploadPrivateFileToCloudinary`), so this
// goes through the in-memory upload + signature-check pair rather than
// `multerUpload`'s direct-to-public-storage path everything else here uses.
router.patch(
    "/manage/:courseId/curriculum-pdf",
    checkAuth(...STAFF),
    trackActivity("course.curriculumPdf.upload"),
    multerMemoryUpload.single("curriculumPdf"),
    verifyFileSignatures,
    CourseController.uploadCurriculumPdf,
);
router.delete(
    "/manage/:courseId/curriculum-pdf",
    checkAuth(...STAFF),
    trackActivity("course.curriculumPdf.remove"),
    CourseController.removeCurriculumPdf,
);

// A course image — the thumbnail or one of the gallery images after it. Staff,
// scoped like the PDF: a mentor for their own courses, an admin for any. The
// upload only stores the file and answers with its URL; the course record
// changes when the form holding that URL is saved, through `updateCourse` or
// `updateCourseContent`. The client crops to 16:9 before sending.
router.post(
    "/staff/:courseId/images",
    checkAuth(...STAFF),
    trackActivity("course.image.upload"),
    multerMemoryUpload.single("image"),
    verifyFileSignatures,
    CourseController.uploadCourseImage,
);

// ---------------------------------------------------------------------------
// Staff route. The curriculum editor is mounted in both consoles and needs the
// course's name; the service narrows a mentor to their own assignments.
// Declared before `/:slug` for the same reason "manage" is.
// ---------------------------------------------------------------------------
router.get("/staff/:courseId", checkAuth(...STAFF), CourseController.getStaffCourseSummary);

// The mentor's course overview: the full record, and the content fields a
// mentor may edit on a course they teach. Commercial settings stay under
// `/manage`, which is admin-only.
router.get("/staff/:courseId/detail", checkAuth(...STAFF), CourseController.getStaffCourse);

// Assignment and quiz results for the course — students by name only.
router.get("/staff/:courseId/results", checkAuth(...STAFF), CourseController.getStaffCourseResults);

router.patch(
    "/staff/:courseId/content",
    checkAuth(...STAFF),
    trackActivity("course.content.update"),
    validateRequest(courseContentZodSchema),
    CourseController.updateCourseContent,
);

// ---------------------------------------------------------------------------
// Public routes
// ---------------------------------------------------------------------------
router.get("/", CourseController.getPublicCourses);
// The roadmap PDF download — any signed-in account, not just students (plan
// §1/§11). `checkAuth()` with no roles is "must be signed in, any role"; a
// guest gets a 401 and the client shows the create-account/sign-in prompt
// instead of attempting the request. Declared before `/:slug` so the extra
// path segment is never swallowed by the slug param.
router.get("/:slug/curriculum-pdf", checkAuth(), CourseController.downloadCurriculumPdf);
// `optionalAuth` so the response can tell a signed-in student they are already
// enrolled, without locking visitors out of the page.
router.get("/:slug", optionalAuth, CourseController.getCourseBySlug);

export const CourseRoutes = router;
