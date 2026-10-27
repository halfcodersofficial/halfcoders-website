import { Request, Response } from "express";
import status from "http-status";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { CourseModuleService } from "./courseModule.service";

const createModule = catchAsync(async (req: Request, res: Response) => {
    const result = await CourseModuleService.createModule(req.user, req.body);

    sendResponse(res, {
        httpStatusCode: status.CREATED,
        success: true,
        message: "Module created successfully",
        data: result,
    });
});

const updateModule = catchAsync(async (req: Request, res: Response) => {
    const result = await CourseModuleService.updateModule(
        req.user,
        req.params.moduleId as string,
        req.body,
    );

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Module updated successfully",
        data: result,
    });
});

const deleteModule = catchAsync(async (req: Request, res: Response) => {
    await CourseModuleService.deleteModule(req.user, req.params.moduleId as string);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Module deleted successfully",
        data: null,
    });
});

const reorderModules = catchAsync(async (req: Request, res: Response) => {
    const result = await CourseModuleService.reorderModules(
        req.user,
        req.params.milestoneId as string,
        req.body.orderedIds,
    );

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Modules reordered successfully",
        data: result,
    });
});

const getModulesByMilestone = catchAsync(async (req: Request, res: Response) => {
    const result = await CourseModuleService.getModulesByMilestone(
        req.user,
        req.params.milestoneId as string,
    );

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Modules fetched successfully",
        data: result,
    });
});

export const CourseModuleController = {
    createModule,
    updateModule,
    deleteModule,
    reorderModules,
    getModulesByMilestone,
};
