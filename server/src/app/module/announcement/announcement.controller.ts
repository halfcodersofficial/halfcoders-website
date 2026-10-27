import { Request, Response } from "express";
import status from "http-status";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { AnnouncementService } from "./announcement.service";

const ok = (res: Response, message: string, data: unknown, httpStatusCode: number = status.OK) =>
    sendResponse(res, { httpStatusCode, success: true, message, data });

const listForCourse = catchAsync(async (req: Request, res: Response) => {
    ok(res, "Announcements retrieved", await AnnouncementService.listForCourse(req.user, req.params.courseId as string));
});

const listForCourseSlug = catchAsync(async (req: Request, res: Response) => {
    ok(res, "Announcements retrieved", await AnnouncementService.listForCourseSlug(req.user, req.params.slug as string));
});

const create = catchAsync(async (req: Request, res: Response) => {
    ok(res, "Announcement posted", await AnnouncementService.create(req.user, req.params.courseId as string, req.body), status.CREATED);
});

const update = catchAsync(async (req: Request, res: Response) => {
    ok(res, "Announcement updated", await AnnouncementService.update(req.user, req.params.announcementId as string, req.body));
});

const remove = catchAsync(async (req: Request, res: Response) => {
    await AnnouncementService.remove(req.user, req.params.announcementId as string);
    ok(res, "Announcement deleted", null);
});

export const AnnouncementController = { listForCourse, listForCourseSlug, create, update, remove };
