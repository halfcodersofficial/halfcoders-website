import { Router } from "express";
import { multerMemoryUpload, verifyFileSignatures } from "../../config/multer.config";
import { Role } from "../../lib/roles";
import { trackActivity } from "../../lib/staffActivity";
import { checkAuth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { AssignmentController } from "./assignment.controller";
import {
    createAssignmentZodSchema,
    reorderAssignmentsZodSchema,
    claimSubmissionZodSchema,
    reviewSubmissionZodSchema,
    setRubricZodSchema,
    submitAssignmentZodSchema,
    updateAssignmentZodSchema,
} from "./assignment.validation";

const router = Router();

const STAFF = [Role.MENTOR, Role.ADMIN, Role.SUPER_ADMIN] as const;

// ---- Staff: authoring and review. Declared before "/:assignmentId" so
// literal segments aren't captured by the parameter.

router.post(
    "/manage",
    checkAuth(...STAFF),
    trackActivity("assignment.create"),
    validateRequest(createAssignmentZodSchema),
    AssignmentController.createAssignment,
);

router.patch(
    "/manage/:assignmentId",
    checkAuth(...STAFF),
    trackActivity("assignment.update"),
    validateRequest(updateAssignmentZodSchema),
    AssignmentController.updateAssignment,
);

router.patch(
    "/manage/milestone/:milestoneId/reorder",
    checkAuth(...STAFF),
    trackActivity("assignment.reorder"),
    validateRequest(reorderAssignmentsZodSchema),
    AssignmentController.reorderAssignments,
);

router.delete("/manage/:assignmentId", checkAuth(...STAFF), trackActivity("assignment.delete"), AssignmentController.deleteAssignment);

// The marking rubric: lines whose points add up to the assignment's marks.
router.get("/manage/:assignmentId/rubric", checkAuth(...STAFF), AssignmentController.getRubric);
router.put(
    "/manage/:assignmentId/rubric",
    checkAuth(...STAFF),
    trackActivity("assignment.rubric"),
    validateRequest(setRubricZodSchema),
    AssignmentController.setRubric,
);

router.get("/submissions/queue", checkAuth(...STAFF), AssignmentController.getReviewQueue);
// Per-status totals for the queue's tabs. Before `/submissions/:submissionId`, which would take "queue".
router.get("/submissions/queue/counts", checkAuth(...STAFF), AssignmentController.getReviewQueueCounts);

router.patch(
    "/submissions/:submissionId/review",
    checkAuth(...STAFF),
    trackActivity("submission.review"),
    validateRequest(reviewSubmissionZodSchema),
    AssignmentController.reviewSubmission,
);

// "I'm reviewing this" — and, from the same reviewer (or an admin), "put it back".
router.post(
    "/submissions/:submissionId/claim",
    checkAuth(...STAFF),
    trackActivity("submission.claim"),
    validateRequest(claimSubmissionZodSchema),
    AssignmentController.claimSubmission,
);
router.delete("/submissions/:submissionId/claim", checkAuth(...STAFF), AssignmentController.releaseSubmission);

// ---- Student
router.get("/my-submissions", checkAuth(Role.STUDENT), AssignmentController.getMySubmissions);
// The one route both sides share: readable by the owning student or by staff
// who manage the course, and the service decides which.
router.get("/submissions/:submissionId", checkAuth(), AssignmentController.getSubmissionById);

router.get(
    "/:assignmentId",
    checkAuth(Role.STUDENT),
    AssignmentController.getAssignmentForStudent,
);

// A student's files for their hand-in: PDFs and images, up to 5 at 5 MB, content-checked.
router.post(
    "/:assignmentId/files",
    checkAuth(Role.STUDENT),
    multerMemoryUpload.array("files", 5),
    verifyFileSignatures,
    AssignmentController.uploadSubmissionFiles,
);

router.post(
    "/:assignmentId/submit",
    checkAuth(Role.STUDENT),
    validateRequest(submitAssignmentZodSchema),
    AssignmentController.submitAssignment,
);

export const AssignmentRoutes = router;
