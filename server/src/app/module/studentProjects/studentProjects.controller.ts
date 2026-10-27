import { Request, Response } from "express";
import status from "http-status";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { StudentProjectsService } from "./studentProjects.service";

const getMyProjects = catchAsync(async (req: Request, res: Response) => {
    const result = await StudentProjectsService.getMyProjects(req.user);
    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Projects fetched successfully",
        data: result,
    });
});

const createProject = catchAsync(async (req: Request, res: Response) => {
    const result = await StudentProjectsService.createProject(req.user, req.body);
    sendResponse(res, {
        httpStatusCode: status.CREATED,
        success: true,
        message: "Project added successfully",
        data: result,
    });
});

const updateProject = catchAsync(async (req: Request, res: Response) => {
    const result = await StudentProjectsService.updateProject(
        req.user,
        req.params.projectId as string,
        req.body,
    );
    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Project updated successfully",
        data: result,
    });
});

const deleteProject = catchAsync(async (req: Request, res: Response) => {
    await StudentProjectsService.deleteProject(req.user, req.params.projectId as string);
    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Project removed successfully",
        data: null,
    });
});

export const StudentProjectsController = {
    getMyProjects,
    createProject,
    updateProject,
    deleteProject,
};
