import { Request, Response } from "express";
import status from "http-status";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { StudentSkillsService } from "./studentSkills.service";

const getMySkills = catchAsync(async (req: Request, res: Response) => {
    const result = await StudentSkillsService.getMySkills(req.user);
    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Skills fetched successfully",
        data: result,
    });
});

const createSkill = catchAsync(async (req: Request, res: Response) => {
    const result = await StudentSkillsService.createSkill(req.user, req.body);
    sendResponse(res, {
        httpStatusCode: status.CREATED,
        success: true,
        message: "Skill added successfully",
        data: result,
    });
});

const updateSkill = catchAsync(async (req: Request, res: Response) => {
    const result = await StudentSkillsService.updateSkill(req.user, req.params.skillId as string, req.body);
    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Skill updated successfully",
        data: result,
    });
});

const deleteSkill = catchAsync(async (req: Request, res: Response) => {
    await StudentSkillsService.deleteSkill(req.user, req.params.skillId as string);
    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Skill removed successfully",
        data: null,
    });
});

export const StudentSkillsController = {
    getMySkills,
    createSkill,
    updateSkill,
    deleteSkill,
};
