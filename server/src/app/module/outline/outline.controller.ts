import { Request, Response } from "express";
import status from "http-status";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { OutlineService } from "./outline.service";

const getOutline = catchAsync(async (req: Request, res: Response) => {
    const result = await OutlineService.getOutline(req.user, req.params.courseId as string);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Outline fetched successfully",
        data: result,
    });
});

const createWeek = catchAsync(async (req: Request, res: Response) => {
    const result = await OutlineService.createWeek(req.user, req.body);

    sendResponse(res, {
        httpStatusCode: status.CREATED,
        success: true,
        message: "Week added successfully",
        data: result,
    });
});

const updateWeek = catchAsync(async (req: Request, res: Response) => {
    const result = await OutlineService.updateWeek(req.user, req.params.weekId as string, req.body);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Week updated successfully",
        data: result,
    });
});

const deleteWeek = catchAsync(async (req: Request, res: Response) => {
    await OutlineService.deleteWeek(req.user, req.params.weekId as string);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Week deleted successfully",
        data: null,
    });
});

const reorderWeeks = catchAsync(async (req: Request, res: Response) => {
    const result = await OutlineService.reorderWeeks(
        req.user,
        req.params.courseId as string,
        req.body.orderedIds,
    );

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Weeks reordered successfully",
        data: result,
    });
});

const createItem = catchAsync(async (req: Request, res: Response) => {
    const result = await OutlineService.createItem(req.user, req.body);

    sendResponse(res, {
        httpStatusCode: status.CREATED,
        success: true,
        message: "Outline item added successfully",
        data: result,
    });
});

const updateItem = catchAsync(async (req: Request, res: Response) => {
    const result = await OutlineService.updateItem(req.user, req.params.itemId as string, req.body);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Outline item updated successfully",
        data: result,
    });
});

const reorderItems = catchAsync(async (req: Request, res: Response) => {
    const result = await OutlineService.reorderItems(req.user, req.params.weekId as string, req.body.orderedIds);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Outline items reordered successfully",
        data: result,
    });
});

const deleteItem = catchAsync(async (req: Request, res: Response) => {
    await OutlineService.deleteItem(req.user, req.params.itemId as string);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Outline item deleted successfully",
        data: null,
    });
});

const publishAll = catchAsync(async (req: Request, res: Response) => {
    const result = await OutlineService.publishAll(req.user, req.params.courseId as string, req.body);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Outline items published successfully",
        data: result,
    });
});

const copyFromModules = catchAsync(async (req: Request, res: Response) => {
    const result = await OutlineService.copyFromModules(req.user, req.params.courseId as string);

    sendResponse(res, {
        httpStatusCode: status.CREATED,
        success: true,
        message: "Outline copied from modules successfully",
        data: result,
    });
});

export const OutlineController = {
    getOutline,
    createWeek,
    updateWeek,
    deleteWeek,
    reorderWeeks,
    createItem,
    updateItem,
    reorderItems,
    deleteItem,
    publishAll,
    copyFromModules,
};
