import { Request, Response } from "express";
import status from "http-status";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { getSupportSlotMinutes } from "../../utils/platformSettings";
import { SupportService } from "./support.service";

/** What a new session starts from — the scheduling forms prefill with it. */
const getDefaults = catchAsync(async (_req: Request, res: Response) => {
    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Support session defaults fetched successfully",
        data: { slotMinutes: await getSupportSlotMinutes() },
    });
});

const createSession = catchAsync(async (req: Request, res: Response) => {
    const result = await SupportService.createSession(req.user, req.body);

    sendResponse(res, {
        httpStatusCode: status.CREATED,
        success: true,
        message: "Support session scheduled successfully",
        data: result,
    });
});

const updateSession = catchAsync(async (req: Request, res: Response) => {
    const result = await SupportService.updateSession(
        req.user,
        req.params.sessionId as string,
        req.body,
    );

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Support session updated successfully",
        data: result,
    });
});

const setSessionStatus = catchAsync(async (req: Request, res: Response) => {
    const result = await SupportService.setSessionStatus(
        req.user,
        req.params.sessionId as string,
        req.body.status,
    );

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: `Support session is now ${req.body.status}`,
        data: result,
    });
});

const deleteSession = catchAsync(async (req: Request, res: Response) => {
    await SupportService.deleteSession(req.user, req.params.sessionId as string);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Support session deleted successfully",
        data: null,
    });
});

const getMyPastSessions = catchAsync(async (req: Request, res: Response) => {
    const result = await SupportService.getMyPastSessions(req.user, req.query);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Past support sessions fetched successfully",
        data: result.data,
        meta: result.meta,
    });
});

const getSessionsByCourse = catchAsync(async (req: Request, res: Response) => {
    const result = await SupportService.getSessionsByCourse(req.user, req.params.courseId as string);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Support sessions fetched successfully",
        data: result,
    });
});

const getSessionsForStudent = catchAsync(async (req: Request, res: Response) => {
    const result = await SupportService.getSessionsForStudent(
        req.user,
        req.params.courseId as string,
    );

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Support sessions fetched successfully",
        data: result,
    });
});

const joinQueue = catchAsync(async (req: Request, res: Response) => {
    const result = await SupportService.joinQueue(
        req.user,
        req.params.sessionId as string,
        req.body?.topic,
    );

    sendResponse(res, {
        httpStatusCode: status.CREATED,
        success: true,
        message: `You're in the queue — your number is #${String(result.queueNumber).padStart(2, "0")}`,
        data: result,
    });
});

const leaveQueue = catchAsync(async (req: Request, res: Response) => {
    await SupportService.leaveQueue(req.user, req.params.sessionId as string);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "You've left the queue",
        data: null,
    });
});

const getMyQueuePosition = catchAsync(async (req: Request, res: Response) => {
    const result = await SupportService.getMyQueuePosition(
        req.user,
        req.params.sessionId as string,
    );

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Queue position fetched successfully",
        data: result,
    });
});

const getQueue = catchAsync(async (req: Request, res: Response) => {
    const result = await SupportService.getQueue(req.user, req.params.sessionId as string);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Queue fetched successfully",
        data: result,
    });
});

const serveNext = catchAsync(async (req: Request, res: Response) => {
    const result = await SupportService.serveNext(
        req.user,
        req.params.sessionId as string,
        req.body?.mentorNote,
    );

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: result
            ? `Now serving #${String(result.queueNumber).padStart(2, "0")}`
            : "Queue is empty — nobody is waiting",
        data: result,
    });
});

const completeCurrent = catchAsync(async (req: Request, res: Response) => {
    const result = await SupportService.completeCurrent(
        req.user,
        req.params.sessionId as string,
        req.body?.mentorNote,
    );

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Support completed",
        data: result,
    });
});

const skipStudent = catchAsync(async (req: Request, res: Response) => {
    const result = await SupportService.skipStudent(
        req.user,
        req.params.queueId as string,
        req.body?.mentorNote,
    );

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Student skipped",
        data: result,
    });
});

const getSessionHistory = catchAsync(async (req: Request, res: Response) => {
    const result = await SupportService.getSessionHistory(req.user, req.params.sessionId as string);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Session history fetched successfully",
        data: result,
    });
});

const getSupportCourses = catchAsync(async (_req: Request, res: Response) => {
    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Support courses retrieved successfully",
        data: await SupportService.getSupportCourses(),
    });
});

const getSupportCourse = catchAsync(async (req: Request, res: Response) => {
    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Support course retrieved successfully",
        data: await SupportService.getSupportCourse(req.params.courseId as string),
    });
});

export const SupportController = {
    getDefaults,
    getSupportCourses,
    getSupportCourse,
    createSession,
    updateSession,
    setSessionStatus,
    deleteSession,
    getSessionsByCourse,
    getMyPastSessions,
    getSessionsForStudent,
    joinQueue,
    leaveQueue,
    getMyQueuePosition,
    getQueue,
    serveNext,
    completeCurrent,
    skipStudent,
    getSessionHistory,
};
