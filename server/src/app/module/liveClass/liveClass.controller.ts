import { Request, Response } from "express";
import status from "http-status";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { LiveClassService } from "./liveClass.service";

const ok = (res: Response, message: string, data: unknown, httpStatusCode: number = status.OK) =>
    sendResponse(res, { httpStatusCode, success: true, message, data });

const listForStaff = catchAsync(async (req: Request, res: Response) => {
    ok(res, "Live classes retrieved", await LiveClassService.listForStaff(req.user, req.params.courseId as string));
});

const listForLearner = catchAsync(async (req: Request, res: Response) => {
    ok(res, "Live classes retrieved", await LiveClassService.listForLearner(req.user, req.params.slug as string));
});

const listMine = catchAsync(async (req: Request, res: Response) => {
    ok(res, "Live classes retrieved", await LiveClassService.listMine(req.user));
});

const create = catchAsync(async (req: Request, res: Response) => {
    ok(res, "Live class scheduled", await LiveClassService.create(req.user, req.params.courseId as string, req.body), status.CREATED);
});

const update = catchAsync(async (req: Request, res: Response) => {
    ok(res, "Live class updated", await LiveClassService.update(req.user, req.params.liveClassId as string, req.body));
});

const cancel = catchAsync(async (req: Request, res: Response) => {
    ok(res, "Live class cancelled", await LiveClassService.cancel(req.user, req.params.liveClassId as string));
});

const remove = catchAsync(async (req: Request, res: Response) => {
    await LiveClassService.remove(req.user, req.params.liveClassId as string);
    ok(res, "Live class removed", null);
});

export const LiveClassController = { listForStaff, listForLearner, listMine, create, update, cancel, remove };
