import { Request, Response } from "express";
import status from "http-status";
import { IQueryParams } from "../../interfaces/query.interface";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { LessonQaService } from "./lessonQa.service";

const ok = (res: Response, message: string, data: unknown, httpStatusCode: number = status.OK) =>
    sendResponse(res, { httpStatusCode, success: true, message, data });

const listForLesson = catchAsync(async (req: Request, res: Response) => {
    ok(res, "Questions retrieved", await LessonQaService.listForLesson(req.user, req.params.videoId as string));
});

const ask = catchAsync(async (req: Request, res: Response) => {
    ok(res, "Question posted", await LessonQaService.ask(req.user, req.params.videoId as string, req.body.body), status.CREATED);
});

const answer = catchAsync(async (req: Request, res: Response) => {
    ok(res, "Answer posted", await LessonQaService.answer(req.user, req.params.questionId as string, req.body.body), status.CREATED);
});

const setResolved = catchAsync(async (req: Request, res: Response) => {
    ok(res, "Question updated", await LessonQaService.setResolved(req.user, req.params.questionId as string, req.body.isResolved));
});

const removeQuestion = catchAsync(async (req: Request, res: Response) => {
    await LessonQaService.removeQuestion(req.user, req.params.questionId as string);
    ok(res, "Question removed", null);
});

const removeAnswer = catchAsync(async (req: Request, res: Response) => {
    await LessonQaService.removeAnswer(req.user, req.params.answerId as string);
    ok(res, "Answer removed", null);
});

const inbox = catchAsync(async (req: Request, res: Response) => {
    const result = await LessonQaService.inbox(req.user, req.query as IQueryParams);
    sendResponse(res, { httpStatusCode: status.OK, success: true, message: "Questions retrieved", data: result.data, meta: result.meta });
});

export const LessonQaController = { listForLesson, ask, answer, setResolved, removeQuestion, removeAnswer, inbox };
