import { Request, Response } from "express";
import status from "http-status";
import { IQueryParams } from "../../interfaces/query.interface";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { CourseReviewService } from "./courseReview.service";

const ok = (res: Response, message: string, data: unknown) => sendResponse(res, { httpStatusCode: status.OK, success: true, message, data });

const getMine = catchAsync(async (req: Request, res: Response) => {
    ok(res, "Review retrieved", await CourseReviewService.getMine(req.user, req.params.courseId as string));
});

const create = catchAsync(async (req: Request, res: Response) => {
    ok(res, "Thanks — your review is with us for approval", await CourseReviewService.create(req.user, req.params.courseId as string, req.body));
});

const getPublic = catchAsync(async (req: Request, res: Response) => {
    ok(res, "Reviews retrieved", await CourseReviewService.getPublic(req.params.slug as string));
});

const getForStaff = catchAsync(async (req: Request, res: Response) => {
    ok(res, "Reviews retrieved", await CourseReviewService.getForStaff(req.user, req.params.courseId as string));
});

const getForAdmin = catchAsync(async (req: Request, res: Response) => {
    const result = await CourseReviewService.getForAdmin(req.query as IQueryParams);
    sendResponse(res, { httpStatusCode: status.OK, success: true, message: "Reviews retrieved", data: result.data, meta: result.meta });
});

const getCounts = catchAsync(async (_req: Request, res: Response) => {
    ok(res, "Counts retrieved", await CourseReviewService.getCounts());
});

const moderate = catchAsync(async (req: Request, res: Response) => {
    ok(res, "Review updated", await CourseReviewService.moderate(req.user, req.params.reviewId as string, req.body.status));
});

export const CourseReviewController = { getMine, create, getPublic, getForStaff, getForAdmin, getCounts, moderate };
