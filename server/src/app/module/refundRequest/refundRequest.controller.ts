import { Request, Response } from "express";
import status from "http-status";
import { IQueryParams } from "../../interfaces/query.interface";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { RefundRequestService } from "./refundRequest.service";

const ok = (res: Response, message: string, data: unknown, httpStatusCode: number = status.OK) =>
    sendResponse(res, { httpStatusCode, success: true, message, data });

const request = catchAsync(async (req: Request, res: Response) => {
    ok(res, "Refund requested — we'll be in touch", await RefundRequestService.request(req.user, req.body), status.CREATED);
});
const mine = catchAsync(async (req: Request, res: Response) => ok(res, "Requests retrieved", await RefundRequestService.mine(req.user)));
const withdraw = catchAsync(async (req: Request, res: Response) => {
    ok(res, "Request withdrawn", await RefundRequestService.withdraw(req.user, req.params.requestId as string));
});
const list = catchAsync(async (req: Request, res: Response) => {
    const result = await RefundRequestService.list(req.query as IQueryParams);
    sendResponse(res, { httpStatusCode: status.OK, success: true, message: "Requests retrieved", data: result.data, meta: result.meta });
});
const counts = catchAsync(async (_req: Request, res: Response) => ok(res, "Counts retrieved", await RefundRequestService.counts()));
const decide = catchAsync(async (req: Request, res: Response) => {
    ok(res, "Decision recorded", await RefundRequestService.decide(req.user, req.params.requestId as string, req.body));
});

export const RefundRequestController = { request, mine, withdraw, list, counts, decide };
