import { Request, Response } from "express";
import status from "http-status";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { CategoryService } from "./category.service";

const getPublicCategories = catchAsync(async (_req: Request, res: Response) => {
    const result = await CategoryService.getPublicCategories();

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Categories fetched successfully",
        data: result,
    });
});

const getAllCategories = catchAsync(async (_req: Request, res: Response) => {
    const result = await CategoryService.getAllCategories();

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Categories fetched successfully",
        data: result,
    });
});

const createCategory = catchAsync(async (req: Request, res: Response) => {
    const result = await CategoryService.createCategory(req.body);

    sendResponse(res, {
        httpStatusCode: status.CREATED,
        success: true,
        message: "Category created successfully",
        data: result,
    });
});

const updateCategory = catchAsync(async (req: Request, res: Response) => {
    const result = await CategoryService.updateCategory(req.params.categoryId as string, req.body);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Category updated successfully",
        data: result,
    });
});

const deleteCategory = catchAsync(async (req: Request, res: Response) => {
    await CategoryService.deleteCategory(req.params.categoryId as string);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Category deleted successfully",
        data: null,
    });
});

export const CategoryController = {
    getPublicCategories,
    getAllCategories,
    createCategory,
    updateCategory,
    deleteCategory,
};
