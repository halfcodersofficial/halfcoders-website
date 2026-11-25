import { Request, Response } from "express";
import status from "http-status";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { type LessonRef, LessonService } from "./lesson.service";

/** Which lesson the route names — a module's (`:videoId`) or a practice day's (`:materialId`). */
const lessonOf = (req: Request): LessonRef =>
    req.params.materialId ? { kind: "practice", id: req.params.materialId as string } : { kind: "video", id: req.params.videoId as string };

const getLessonState = catchAsync(async (req: Request, res: Response) => {
    const result = await LessonService.getLessonState(req.user, lessonOf(req));

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Lesson state fetched successfully",
        data: result,
    });
});

const saveNote = catchAsync(async (req: Request, res: Response) => {
    const result = await LessonService.saveNote(req.user, lessonOf(req), req.body.content);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Note saved",
        data: result,
    });
});

const setBookmark = catchAsync(async (req: Request, res: Response) => {
    const result = await LessonService.setBookmark(req.user, lessonOf(req), req.body.bookmarked);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: req.body.bookmarked ? "Lesson bookmarked" : "Bookmark removed",
        data: result,
    });
});

const setReaction = catchAsync(async (req: Request, res: Response) => {
    const result = await LessonService.setReaction(req.user, lessonOf(req), req.body.reaction);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Reaction saved",
        data: result,
    });
});

const getCourseBookmarks = catchAsync(async (req: Request, res: Response) => {
    const result = await LessonService.getCourseBookmarks(req.user, req.params.courseId as string);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Bookmarks fetched successfully",
        data: result,
    });
});

export const LessonController = {
    getLessonState,
    saveNote,
    setBookmark,
    setReaction,
    getCourseBookmarks,
};
