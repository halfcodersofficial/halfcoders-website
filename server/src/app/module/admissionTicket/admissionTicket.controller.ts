import { Request, Response } from "express";
import status from "http-status";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { AdmissionTicketService } from "./admissionTicket.service";

const ok = (res: Response, message: string, data: unknown) => sendResponse(res, { httpStatusCode: status.OK, success: true, message, data });

const courseIdOf = (req: Request) => req.params.courseId as string;

const getTicketCourses = catchAsync(async (_req: Request, res: Response) =>
    ok(res, "Admission tickets retrieved", await AdmissionTicketService.getTicketCourses()),
);
const getTicketCourse = catchAsync(async (req: Request, res: Response) =>
    ok(res, "Admission ticket retrieved", await AdmissionTicketService.getTicketCourse(courseIdOf(req))),
);
const saveTicket = catchAsync(async (req: Request, res: Response) =>
    ok(res, "Admission ticket saved", await AdmissionTicketService.saveTicket(courseIdOf(req), req.body)),
);
const deleteTicket = catchAsync(async (req: Request, res: Response) => {
    await AdmissionTicketService.deleteTicket(courseIdOf(req));
    ok(res, "Admission ticket removed", null);
});
const getMyTicket = catchAsync(async (req: Request, res: Response) =>
    ok(res, "Admission ticket retrieved", await AdmissionTicketService.getMyTicket(req.user, courseIdOf(req))),
);

export const AdmissionTicketController = {
    getTicketCourses,
    getTicketCourse,
    saveTicket,
    deleteTicket,
    getMyTicket,
};
