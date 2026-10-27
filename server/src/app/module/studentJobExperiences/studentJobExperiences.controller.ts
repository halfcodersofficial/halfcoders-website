import { Request, Response } from "express";
import status from "http-status";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { StudentJobExperiencesService } from "./studentJobExperiences.service";

const getMyJobExperiences = catchAsync(async (req: Request, res: Response) => {
    const result = await StudentJobExperiencesService.getMyJobExperiences(req.user);
    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Job experiences fetched successfully",
        data: result,
    });
});

const createJobExperience = catchAsync(async (req: Request, res: Response) => {
    const result = await StudentJobExperiencesService.createJobExperience(req.user, req.body);
    sendResponse(res, {
        httpStatusCode: status.CREATED,
        success: true,
        message: "Job experience added successfully",
        data: result,
    });
});

const updateJobExperience = catchAsync(async (req: Request, res: Response) => {
    const result = await StudentJobExperiencesService.updateJobExperience(
        req.user,
        req.params.experienceId as string,
        req.body,
    );
    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Job experience updated successfully",
        data: result,
    });
});

const deleteJobExperience = catchAsync(async (req: Request, res: Response) => {
    await StudentJobExperiencesService.deleteJobExperience(
        req.user,
        req.params.experienceId as string,
    );
    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Job experience removed successfully",
        data: null,
    });
});

export const StudentJobExperiencesController = {
    getMyJobExperiences,
    createJobExperience,
    updateJobExperience,
    deleteJobExperience,
};
