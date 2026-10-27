import { Router } from "express";
import z from "zod";
import { Role } from "../../lib/roles";
import { checkAuth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { LessonController } from "./lesson.controller";

const router = Router();

const noteZodSchema = z.object({
    content: z.string().max(10_000, "Notes can be at most 10,000 characters"),
});

const bookmarkZodSchema = z.object({
    bookmarked: z.boolean(),
});

const reactionZodSchema = z.object({
    reaction: z.enum(["LIKE", "DISLIKE"]).nullable(),
});

router.get("/videos/:videoId", checkAuth(Role.STUDENT), LessonController.getLessonState);
router.put(
    "/videos/:videoId/note",
    checkAuth(Role.STUDENT),
    validateRequest(noteZodSchema),
    LessonController.saveNote,
);
router.patch(
    "/videos/:videoId/bookmark",
    checkAuth(Role.STUDENT),
    validateRequest(bookmarkZodSchema),
    LessonController.setBookmark,
);
router.patch(
    "/videos/:videoId/reaction",
    checkAuth(Role.STUDENT),
    validateRequest(reactionZodSchema),
    LessonController.setReaction,
);

router.get(
    "/courses/:courseId/bookmarks",
    checkAuth(Role.STUDENT),
    LessonController.getCourseBookmarks,
);

export const LessonRoutes = router;
