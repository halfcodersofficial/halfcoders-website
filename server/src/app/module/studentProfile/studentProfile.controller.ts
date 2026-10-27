import { Request, Response } from "express";
import status from "http-status";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { StudentProfileService } from "./studentProfile.service";

const getOverview = catchAsync(async (req: Request, res: Response) => {
    const result = await StudentProfileService.getOverview(req.user);
    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Profile overview fetched successfully",
        data: result,
    });
});

const getAdditionalInfo = catchAsync(async (req: Request, res: Response) => {
    const result = await StudentProfileService.getAdditionalInfo(req.user);
    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Additional info fetched successfully",
        data: result,
    });
});

const updateAdditionalInfo = catchAsync(async (req: Request, res: Response) => {
    const result = await StudentProfileService.updateAdditionalInfo(req.user, req.body);
    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Additional info updated successfully",
        data: result,
    });
});

const getAddress = catchAsync(async (req: Request, res: Response) => {
    const result = await StudentProfileService.getAddress(req.user);
    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Address fetched successfully",
        data: result,
    });
});

const updateAddress = catchAsync(async (req: Request, res: Response) => {
    const result = await StudentProfileService.updateAddress(req.user, req.body);
    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Address updated successfully",
        data: result,
    });
});

const getEducation = catchAsync(async (req: Request, res: Response) => {
    const result = await StudentProfileService.getEducation(req.user);
    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Education fetched successfully",
        data: result,
    });
});

const updateEducation = catchAsync(async (req: Request, res: Response) => {
    const result = await StudentProfileService.updateEducation(req.user, req.body);
    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Education updated successfully",
        data: result,
    });
});

const getLinks = catchAsync(async (req: Request, res: Response) => {
    const result = await StudentProfileService.getLinks(req.user);
    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Important links fetched successfully",
        data: result,
    });
});

const updateLinks = catchAsync(async (req: Request, res: Response) => {
    const result = await StudentProfileService.updateLinks(req.user, req.body);
    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Important links updated successfully",
        data: result,
    });
});

const getJobProfile = catchAsync(async (req: Request, res: Response) => {
    const result = await StudentProfileService.getJobProfile(req.user);
    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Job profile fetched successfully",
        data: result,
    });
});

const updateJobProfile = catchAsync(async (req: Request, res: Response) => {
    const result = await StudentProfileService.updateJobProfile(req.user, req.body);
    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Job profile updated successfully",
        data: result,
    });
});

export const StudentProfileController = {
    getOverview,
    getAdditionalInfo,
    updateAdditionalInfo,
    getAddress,
    updateAddress,
    getEducation,
    updateEducation,
    getLinks,
    updateLinks,
    getJobProfile,
    updateJobProfile,
};
