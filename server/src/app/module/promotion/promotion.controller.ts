import { Request, Response } from "express";
import status from "http-status";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { PromotionService } from "./promotion.service";

const ok = (res: Response, message: string, data: unknown, httpStatusCode: number = status.OK) =>
    sendResponse(res, { httpStatusCode, success: true, message, data });

const courseIdOf = (req: Request) => req.params.courseId as string;

const getPromotionCourses = catchAsync(async (_req: Request, res: Response) =>
    ok(res, "Promotions retrieved", await PromotionService.getPromotionCourses()),
);
const getPromotionCourse = catchAsync(async (req: Request, res: Response) =>
    ok(res, "Promotions retrieved", await PromotionService.getPromotionCourse(courseIdOf(req))),
);
const saveOffer = catchAsync(async (req: Request, res: Response) =>
    ok(res, "Offer saved", await PromotionService.saveOffer(courseIdOf(req), req.body)),
);
const deleteOffer = catchAsync(async (req: Request, res: Response) => {
    await PromotionService.deleteOffer(courseIdOf(req));
    ok(res, "Offer removed", null);
});
const saveReward = catchAsync(async (req: Request, res: Response) =>
    ok(res, "Reward saved", await PromotionService.saveReward(courseIdOf(req), req.body)),
);
const deleteReward = catchAsync(async (req: Request, res: Response) => {
    await PromotionService.deleteReward(courseIdOf(req));
    ok(res, "Reward removed", null);
});
const getCoursePromotions = catchAsync(async (req: Request, res: Response) =>
    ok(res, "Course promotions retrieved", await PromotionService.getCoursePromotions(courseIdOf(req), req.user)),
);

export const PromotionController = {
    getPromotionCourses,
    getPromotionCourse,
    saveOffer,
    deleteOffer,
    saveReward,
    deleteReward,
    getCoursePromotions,
};
