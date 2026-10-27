import { Request, Response } from "express";
import status from "http-status";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { LessonService } from "./lesson.service";

const getLessonState = catchAsync(async (req: Request, res: Response) => {
    const result = await LessonService.getLessonState(req.user, req.params.videoId as string);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Lesson state fetched successfully",
        data: result,
    });
});

const saveNote = catchAsync(async (req: Request, res: Response) => {
    const result = await LessonService.saveNote(req.user, req.params.videoId as string, req.body.content);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Note saved",
        data: result,
    });
});

const setBookmark = catchAsync(async (req: Request, res: Response) => {
    const result = await LessonService.setBookmark(
        req.user,
        req.params.videoId as string,
        req.body.bookmarked,
    );

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: req.body.bookmarked ? "Lesson bookmarked" : "Bookmark removed",
        data: result,
    });
});

const setReaction = catchAsync(async (req: Request, res: Response) => {
    const result = await LessonService.setReaction(
        req.user,
        req.params.videoId as string,
        req.body.reaction,
    );

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
