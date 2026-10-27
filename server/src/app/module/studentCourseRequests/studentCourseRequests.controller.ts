import { Request, Response } from "express";
import status from "http-status";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { StudentCourseRequestsService } from "./studentCourseRequests.service";

const getMyCourseRequests = catchAsync(async (req: Request, res: Response) => {
    const result = await StudentCourseRequestsService.getMyCourseRequests(req.user);
    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Course requests fetched successfully",
        data: result,
    });
});

const createCourseRequest = catchAsync(async (req: Request, res: Response) => {
    const result = await StudentCourseRequestsService.createCourseRequest(req.user, req.body);
    sendResponse(res, {
        httpStatusCode: status.CREATED,
        success: true,
        message: "Course request submitted successfully",
        data: result,
    });
});

export const StudentCourseRequestsController = {
    getMyCourseRequests,
    createCourseRequest,
};
