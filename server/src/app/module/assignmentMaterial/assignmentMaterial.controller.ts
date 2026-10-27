import { Request, Response } from "express";
import status from "http-status";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { AssignmentMaterialService } from "./assignmentMaterial.service";

const getMaterials = catchAsync(async (req: Request, res: Response) => {
    const result = await AssignmentMaterialService.getMaterials(req.user, req.params.assignmentId as string);
    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Assignment lessons fetched successfully",
        data: result,
    });
});

const createMaterial = catchAsync(async (req: Request, res: Response) => {
    const result = await AssignmentMaterialService.createMaterial(req.user, req.body);
    sendResponse(res, {
        httpStatusCode: status.CREATED,
        success: true,
        message: "Assignment lesson added successfully",
        data: result,
    });
});

const updateMaterial = catchAsync(async (req: Request, res: Response) => {
    const result = await AssignmentMaterialService.updateMaterial(req.user, req.params.materialId as string, req.body);
    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Assignment lesson updated successfully",
        data: result,
    });
});

const deleteMaterial = catchAsync(async (req: Request, res: Response) => {
    await AssignmentMaterialService.deleteMaterial(req.user, req.params.materialId as string);
    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Assignment lesson deleted successfully",
        data: null,
    });
});

const reorderMaterials = catchAsync(async (req: Request, res: Response) => {
    const result = await AssignmentMaterialService.reorderMaterials(
        req.user,
        req.params.assignmentId as string,
        req.body.orderedIds,
    );
    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Assignment lessons reordered successfully",
        data: result,
    });
});

export const AssignmentMaterialController = {
    getMaterials,
    createMaterial,
    updateMaterial,
    deleteMaterial,
    reorderMaterials,
};
