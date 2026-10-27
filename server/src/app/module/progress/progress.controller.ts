import { Request, Response } from "express";
import status from "http-status";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { ProgressService } from "./progress.service";

const markVideoComplete = catchAsync(async (req: Request, res: Response) => {
    const result = await ProgressService.markVideoComplete(req.user, req.params.videoId as string);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: result.courseCompleted
            ? "Course completed! Your certificate is ready to claim."
            : "Progress saved",
        data: result,
    });
});

const markVideoIncomplete = catchAsync(async (req: Request, res: Response) => {
    const result = await ProgressService.markVideoIncomplete(req.user, req.params.videoId as string);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Video marked as not completed",
        data: result,
    });
});

const updateWatchPosition = catchAsync(async (req: Request, res: Response) => {
    const result = await ProgressService.updateWatchPosition(
        req.user,
        req.params.videoId as string,
        req.body.watchedSeconds,
    );

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Playback position saved",
        data: result,
    });
});

export const ProgressController = {
    markVideoComplete,
    markVideoIncomplete,
    updateWatchPosition,
};
