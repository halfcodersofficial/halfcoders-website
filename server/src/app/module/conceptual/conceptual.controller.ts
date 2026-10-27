import { Request, Response } from "express";
import status from "http-status";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { ConceptualService } from "./conceptual.service";

const ok = (res: Response, message: string, data: unknown, httpStatusCode: number = status.OK) =>
    sendResponse(res, { httpStatusCode, success: true, message, data });

const getManageCourses = catchAsync(async (req: Request, res: Response) => {
    ok(res, "Courses retrieved successfully", await ConceptualService.getManageCourses(req.user));
});

const getManageCourse = catchAsync(async (req: Request, res: Response) => {
    ok(res, "Conceptual sessions retrieved successfully", await ConceptualService.getManageCourse(req.user, req.params.courseId as string));
});

const createTopic = catchAsync(async (req: Request, res: Response) => {
    ok(res, "Topic added successfully", await ConceptualService.createTopic(req.user, req.body), status.CREATED);
});

const updateTopic = catchAsync(async (req: Request, res: Response) => {
    ok(res, "Topic updated successfully", await ConceptualService.updateTopic(req.user, req.params.topicId as string, req.body));
});

const deleteTopic = catchAsync(async (req: Request, res: Response) => {
    await ConceptualService.deleteTopic(req.user, req.params.topicId as string);
    ok(res, "Topic deleted successfully", null);
});

const reorderTopics = catchAsync(async (req: Request, res: Response) => {
    ok(
        res,
        "Topics reordered successfully",
        await ConceptualService.reorderTopics(req.user, req.params.courseId as string, req.body.orderedIds),
    );
});

const createSession = catchAsync(async (req: Request, res: Response) => {
    ok(res, "Recording added successfully", await ConceptualService.createSession(req.user, req.body), status.CREATED);
});

const updateSession = catchAsync(async (req: Request, res: Response) => {
    ok(res, "Recording updated successfully", await ConceptualService.updateSession(req.user, req.params.sessionId as string, req.body));
});

const deleteSession = catchAsync(async (req: Request, res: Response) => {
    await ConceptualService.deleteSession(req.user, req.params.sessionId as string);
    ok(res, "Recording deleted successfully", null);
});

const reorderSessions = catchAsync(async (req: Request, res: Response) => {
    ok(
        res,
        "Recordings reordered successfully",
        await ConceptualService.reorderSessions(req.user, req.params.topicId as string, req.body.orderedIds),
    );
});

const getMyCourses = catchAsync(async (req: Request, res: Response) => {
    ok(res, "Courses retrieved successfully", await ConceptualService.getMyCourses(req.user));
});

const getCourseSessions = catchAsync(async (req: Request, res: Response) => {
    ok(res, "Conceptual sessions retrieved successfully", await ConceptualService.getCourseSessions(req.user, req.params.slug as string));
});

const setWatched = catchAsync(async (req: Request, res: Response) => {
    ok(res, "Saved", await ConceptualService.setWatched(req.user, req.params.sessionId as string, req.body.watched));
});

export const ConceptualController = {
    getManageCourses,
    getManageCourse,
    createTopic,
    updateTopic,
    deleteTopic,
    reorderTopics,
    createSession,
    updateSession,
    deleteSession,
    reorderSessions,
    getMyCourses,
    getCourseSessions,
    setWatched,
};
