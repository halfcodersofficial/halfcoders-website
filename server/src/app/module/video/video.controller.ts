import { Request, Response } from "express";
import status from "http-status";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { VideoService } from "./video.service";

const createVideo = catchAsync(async (req: Request, res: Response) => {
    const result = await VideoService.createVideo(req.user, req.body);

    sendResponse(res, {
        httpStatusCode: status.CREATED,
        success: true,
        message: "Video added successfully",
        data: result,
    });
});

const bulkCreateVideos = catchAsync(async (req: Request, res: Response) => {
    const result = await VideoService.bulkCreateVideos(req.user, req.body);

    sendResponse(res, {
        httpStatusCode: status.CREATED,
        success: true,
        message: `${req.body.videos.length} video(s) added successfully`,
        data: result,
    });
});

const updateVideo = catchAsync(async (req: Request, res: Response) => {
    const result = await VideoService.updateVideo(req.user, req.params.videoId as string, req.body);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Video updated successfully",
        data: result,
    });
});

const deleteVideo = catchAsync(async (req: Request, res: Response) => {
    await VideoService.deleteVideo(req.user, req.params.videoId as string);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Video deleted successfully",
        data: null,
    });
});

const reorderVideos = catchAsync(async (req: Request, res: Response) => {
    const result = await VideoService.reorderVideos(
        req.user,
        req.params.moduleId as string,
        req.body.orderedIds,
    );

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Videos reordered successfully",
        data: result,
    });
});

const getVideosByModule = catchAsync(async (req: Request, res: Response) => {
    const result = await VideoService.getVideosByModule(req.user, req.params.moduleId as string);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Videos fetched successfully",
        data: result,
    });
});

const bulkSetPublished = catchAsync(async (req: Request, res: Response) => {
    const result = await VideoService.bulkSetPublished(req.user, req.body);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: `${result.count} video(s) ${req.body.isPublished ? "published" : "unpublished"}`,
        data: result,
    });
});

export const VideoController = {
    createVideo,
    bulkCreateVideos,
    updateVideo,
    deleteVideo,
    reorderVideos,
    getVideosByModule,
    bulkSetPublished,
};
