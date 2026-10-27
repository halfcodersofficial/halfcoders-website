import { Request, Response } from "express";
import status from "http-status";
import { IQueryParams } from "../../interfaces/query.interface";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { LeaderboardService } from "./leaderboard.service";

const getCourseLeaderboard = catchAsync(async (req: Request, res: Response) => {
    const result = await LeaderboardService.getCourseLeaderboard(
        req.params.courseId as string,
        req.query as IQueryParams,
    );

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Leaderboard fetched successfully",
        data: result.data,
        meta: result.meta,
    });
});

const getMyRank = catchAsync(async (req: Request, res: Response) => {
    const result = await LeaderboardService.getMyRank(req.user, req.params.courseId as string);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Rank fetched successfully",
        data: result,
    });
});

const getMyXpHistory = catchAsync(async (req: Request, res: Response) => {
    const result = await LeaderboardService.getMyXpHistory(req.user, req.query as IQueryParams);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "XP history fetched successfully",
        data: result.data,
        meta: result.meta,
    });
});

const getLeaderboardCourses = catchAsync(async (_req: Request, res: Response) => {
    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Leaderboard courses fetched successfully",
        data: await LeaderboardService.getLeaderboardCourses(),
    });
});

const getLeaderboardCourse = catchAsync(async (req: Request, res: Response) => {
    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Leaderboard course fetched successfully",
        data: await LeaderboardService.getLeaderboardCourse(req.params.courseId as string),
    });
});

export const LeaderboardController = {
    getLeaderboardCourses,
    getLeaderboardCourse, getCourseLeaderboard, getMyRank, getMyXpHistory };
