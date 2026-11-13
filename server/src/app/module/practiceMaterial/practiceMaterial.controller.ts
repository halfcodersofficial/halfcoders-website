import { Request, Response } from "express";
import status from "http-status";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { PracticeMaterialService } from "./practiceMaterial.service";

const getMaterials = catchAsync(async (req: Request, res: Response) => {
    const result = await PracticeMaterialService.getMaterials(req.user, req.params.practiceDayId as string);
    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Practice day lessons fetched successfully",
        data: result,
    });
});

const createMaterial = catchAsync(async (req: Request, res: Response) => {
    const result = await PracticeMaterialService.createMaterial(req.user, req.body);
    sendResponse(res, {
        httpStatusCode: status.CREATED,
        success: true,
        message: "Practice day lesson added successfully",
        data: result,
    });
});

const updateMaterial = catchAsync(async (req: Request, res: Response) => {
    const result = await PracticeMaterialService.updateMaterial(req.user, req.params.materialId as string, req.body);
    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Practice day lesson updated successfully",
        data: result,
    });
});

const deleteMaterial = catchAsync(async (req: Request, res: Response) => {
    await PracticeMaterialService.deleteMaterial(req.user, req.params.materialId as string);
    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Practice day lesson deleted successfully",
        data: null,
    });
});

const reorderMaterials = catchAsync(async (req: Request, res: Response) => {
    const result = await PracticeMaterialService.reorderMaterials(
        req.user,
        req.params.practiceDayId as string,
        req.body.orderedIds,
    );
    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Practice day lessons reordered successfully",
        data: result,
    });
});

export const PracticeMaterialController = {
    getMaterials,
    createMaterial,
    updateMaterial,
    deleteMaterial,
    reorderMaterials,
};
