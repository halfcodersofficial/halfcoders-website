import { Router } from "express";
import { Role } from "../../lib/roles";
import { checkAuth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { LessonQaController } from "./lessonQa.controller";
import { answerZodSchema, askZodSchema, resolveZodSchema } from "./lessonQa.validation";

const router = Router();

const STAFF = [Role.MENTOR, Role.ADMIN, Role.SUPER_ADMIN] as const;

// Staff inbox: open questions across the courses they teach.
router.get("/manage", checkAuth(...STAFF), LessonQaController.inbox);

// A lesson's thread — its students and staff (checked in the service).
router.get("/lesson/:videoId", checkAuth(), LessonQaController.listForLesson);
router.post("/lesson/:videoId", checkAuth(Role.STUDENT), validateRequest(askZodSchema), LessonQaController.ask);
router.post("/:questionId/answers", checkAuth(), validateRequest(answerZodSchema), LessonQaController.answer);
router.patch("/:questionId", checkAuth(), validateRequest(resolveZodSchema), LessonQaController.setResolved);
router.delete("/:questionId", checkAuth(), LessonQaController.removeQuestion);
router.delete("/answers/:answerId", checkAuth(), LessonQaController.removeAnswer);

export const LessonQaRoutes = router;
