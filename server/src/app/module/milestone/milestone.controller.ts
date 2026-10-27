import { Request, Response } from "express";
import status from "http-status";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { MilestoneService } from "./milestone.service";

const createMilestone = catchAsync(async (req: Request, res: Response) => {
    const result = await MilestoneService.createMilestone(req.user, req.body);

    sendResponse(res, {
        httpStatusCode: status.CREATED,
        success: true,
        message: "Milestone created successfully",
        data: result,
    });
});

const updateMilestone = catchAsync(async (req: Request, res: Response) => {
    const result = await MilestoneService.updateMilestone(
        req.user,
        req.params.milestoneId as string,
        req.body,
    );

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Milestone updated successfully",
        data: result,
    });
});

const deleteMilestone = catchAsync(async (req: Request, res: Response) => {
    await MilestoneService.deleteMilestone(req.user, req.params.milestoneId as string);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Milestone deleted successfully",
        data: null,
    });
});

const reorderWeekItems = catchAsync(async (req: Request, res: Response) => {
    await MilestoneService.reorderWeekItems(req.user, req.params.milestoneId as string, req.body.items);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Week reordered successfully",
        data: null,
    });
});

const reorderMilestones = catchAsync(async (req: Request, res: Response) => {
    const result = await MilestoneService.reorderMilestones(
        req.user,
        req.params.courseId as string,
        req.body.orderedIds,
    );

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Milestones reordered successfully",
        data: result,
    });
});

const getMilestonesByCourse = catchAsync(async (req: Request, res: Response) => {
    const result = await MilestoneService.getMilestonesByCourse(
        req.user,
        req.params.courseId as string,
    );

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Milestones fetched successfully",
        data: result,
    });
});

export const MilestoneController = {
    createMilestone,
    updateMilestone,
    deleteMilestone,
    reorderMilestones,
    reorderWeekItems,
    getMilestonesByCourse,
};
