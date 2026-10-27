import { Request, Response } from "express";
import status from "http-status";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { PracticeService } from "./practice.service";

const createPracticeDay = catchAsync(async (req: Request, res: Response) => {
    const result = await PracticeService.createPracticeDay(req.user, req.body);

    sendResponse(res, {
        httpStatusCode: status.CREATED,
        success: true,
        message: "Practice day created successfully",
        data: result,
    });
});

const updatePracticeDay = catchAsync(async (req: Request, res: Response) => {
    const result = await PracticeService.updatePracticeDay(
        req.user,
        req.params.practiceDayId as string,
        req.body,
    );

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Practice day updated successfully",
        data: result,
    });
});

const deletePracticeDay = catchAsync(async (req: Request, res: Response) => {
    await PracticeService.deletePracticeDay(req.user, req.params.practiceDayId as string);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Practice day deleted successfully",
        data: null,
    });
});

const getPracticeDayForStudent = catchAsync(async (req: Request, res: Response) => {
    const result = await PracticeService.getPracticeDayForStudent(
        req.user,
        req.params.practiceDayId as string,
    );

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Practice day fetched successfully",
        data: result,
    });
});

const markComplete = catchAsync(async (req: Request, res: Response) => {
    const result = await PracticeService.markComplete(
        req.user,
        req.params.practiceDayId as string,
        req.body?.note,
    );

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Practice day marked as complete",
        data: result,
    });
});

const markIncomplete = catchAsync(async (req: Request, res: Response) => {
    await PracticeService.markIncomplete(req.user, req.params.practiceDayId as string);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Practice day marked as not complete",
        data: null,
    });
});

export const PracticeController = {
    createPracticeDay,
    updatePracticeDay,
    deletePracticeDay,
    getPracticeDayForStudent,
    markComplete,
    markIncomplete,
};
