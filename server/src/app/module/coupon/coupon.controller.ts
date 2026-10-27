import { Request, Response } from "express";
import status from "http-status";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { sendCsv } from "../../utils/csvExport";
import { CouponService } from "./coupon.service";

const ok = (res: Response, message: string, data: unknown, httpStatusCode: number = status.OK) =>
    sendResponse(res, { httpStatusCode, success: true, message, data });

const check = catchAsync(async (req: Request, res: Response) => {
    // `validateQuery` checks the query but leaves it as sent.
    const code = String(req.query.code).trim();
    const courseId = typeof req.query.courseId === "string" ? req.query.courseId.trim() || undefined : undefined;
    ok(res, "Coupon checked", await CouponService.check(code, courseId, req.user));
});
const list = catchAsync(async (_req: Request, res: Response) => ok(res, "Coupons retrieved", await CouponService.list()));
const detail = catchAsync(async (req: Request, res: Response) => ok(res, "Coupon retrieved", await CouponService.detail(req.params.couponId as string)));
const exportRedemptions = catchAsync(async (req: Request, res: Response) => {
    const { csv, name } = await CouponService.exportRedemptions(req.params.couponId as string);
    sendCsv(res, name, csv);
});
const create = catchAsync(async (req: Request, res: Response) => ok(res, "Coupon created", await CouponService.create(req.user, req.body), status.CREATED));
const update = catchAsync(async (req: Request, res: Response) => ok(res, "Coupon updated", await CouponService.update(req.params.couponId as string, req.body)));
const remove = catchAsync(async (req: Request, res: Response) => {
    await CouponService.remove(req.params.couponId as string);
    ok(res, "Coupon deleted", null);
});

export const CouponController = { check, list, detail, exportRedemptions, create, update, remove };
