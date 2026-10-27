import { Router } from "express";
import { Role } from "../../lib/roles";
import { trackActivity } from "../../lib/staffActivity";
import { checkAuth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { QuizController } from "./quiz.controller";
import {
    createQuestionZodSchema,
    createQuizZodSchema,
    reorderQuestionsZodSchema,
    submitQuizZodSchema,
    updateQuestionZodSchema,
    updateQuizZodSchema,
} from "./quiz.validation";

const router = Router();

const STAFF = [Role.MENTOR, Role.ADMIN, Role.SUPER_ADMIN] as const;

// ---------------------------------------------------------------------------
// Staff: authoring. Declared before the parameterised student routes so
// literal segments like "manage" and "attempts" are never captured by them.
// ---------------------------------------------------------------------------
router.get("/manage/module/:moduleId", checkAuth(...STAFF), QuizController.getQuizForModule);
// Every finished attempt (students by name only) and how each question went.
router.get("/manage/:quizId/results", checkAuth(...STAFF), QuizController.getQuizResults);

router.post(
    "/manage",
    checkAuth(...STAFF),
    trackActivity("quiz.create"),
    validateRequest(createQuizZodSchema),
    QuizController.createQuiz,
);

router.patch(
    "/manage/:quizId",
    checkAuth(...STAFF),
    trackActivity("quiz.update"),
    validateRequest(updateQuizZodSchema),
    QuizController.updateQuiz,
);

router.delete("/manage/:quizId", checkAuth(...STAFF), trackActivity("quiz.delete"), QuizController.deleteQuiz);

router.post(
    "/manage/:quizId/questions",
    checkAuth(...STAFF),
    trackActivity("question.create"),
    validateRequest(createQuestionZodSchema),
    QuizController.createQuestion,
);

router.patch(
    "/manage/:quizId/questions/reorder",
    checkAuth(...STAFF),
    trackActivity("question.reorder"),
    validateRequest(reorderQuestionsZodSchema),
    QuizController.reorderQuestions,
);

router.patch(
    "/manage/questions/:questionId",
    checkAuth(...STAFF),
    trackActivity("question.update"),
    validateRequest(updateQuestionZodSchema),
    QuizController.updateQuestion,
);

router.delete("/manage/questions/:questionId", checkAuth(...STAFF), trackActivity("question.delete"), QuizController.deleteQuestion);

// ---------------------------------------------------------------------------
// Review of one attempt. Declared before "/:quizId" so "attempts" is never
// swallowed by it. A student may read their own; staff need management
// rights on the course — the service decides which applies.
// ---------------------------------------------------------------------------
router.get("/attempts/:attemptId", checkAuth(), QuizController.getAttempt);

// ---------------------------------------------------------------------------
// Student: one quiz — answered in full, submitted once.
// ---------------------------------------------------------------------------
router.get("/:quizId/attempts", checkAuth(Role.STUDENT), QuizController.getMyAttempts);
router.post(
    "/:quizId/submit",
    checkAuth(Role.STUDENT),
    validateRequest(submitQuizZodSchema),
    QuizController.submitQuiz,
);
router.get("/:quizId", checkAuth(Role.STUDENT), QuizController.getQuizForStudent);

export const QuizRoutes = router;
