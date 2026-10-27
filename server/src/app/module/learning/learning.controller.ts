import { Request, Response } from "express";
import status from "http-status";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { LearningService } from "./learning.service";

const getCourseLearning = catchAsync(async (req: Request, res: Response) => {
    const result = await LearningService.getCourseLearning(req.user, req.params.slug as string);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Course content fetched successfully",
        data: result,
    });
});

const getVideo = catchAsync(async (req: Request, res: Response) => {
    const result = await LearningService.getVideo(req.user, req.params.videoId as string);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Video fetched successfully",
        data: result,
    });
});

const getCourseOutline = catchAsync(async (req: Request, res: Response) => {
    const result = await LearningService.getCourseOutline(req.user, req.params.slug as string);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Course outline fetched successfully",
        data: result,
    });
});

export const LearningController = { getCourseLearning, getVideo, getCourseOutline };
