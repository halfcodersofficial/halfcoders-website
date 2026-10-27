import { Request, Response } from "express";
import status from "http-status";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { DashboardService } from "./dashboard.service";

const getStudentDashboard = catchAsync(async (req: Request, res: Response) => {
    const result = await DashboardService.getStudentDashboard(req.user);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Dashboard fetched successfully",
        data: result,
    });
});

const getMentorDashboard = catchAsync(async (req: Request, res: Response) => {
    const result = await DashboardService.getMentorDashboard(req.user);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Dashboard fetched successfully",
        data: result,
    });
});

const getAdminDashboard = catchAsync(async (_req: Request, res: Response) => {
    const result = await DashboardService.getAdminDashboard();

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Dashboard fetched successfully",
        data: result,
    });
});

export const DashboardController = {
    getStudentDashboard,
    getMentorDashboard,
    getAdminDashboard,
};
