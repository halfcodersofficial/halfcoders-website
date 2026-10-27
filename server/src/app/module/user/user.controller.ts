import { Request, Response } from "express";
import status from "http-status";
import AppError from "../../errorHelpers/AppError";
import { IQueryParams } from "../../interfaces/query.interface";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { MentorDetailService } from "./mentorDetail.service";
import { StudentDetailService } from "./studentDetail.service";
import { UserService } from "./user.service";
import { sendCsv } from "../../utils/csvExport";

const getStudents = catchAsync(async (req: Request, res: Response) => {
    const result = await UserService.getStudents(req.query as IQueryParams);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Students fetched successfully",
        data: result.data,
        meta: result.meta,
    });
});

const getStudentById = catchAsync(async (req: Request, res: Response) => {
    const result = await UserService.getStudentById(req.params.userId as string);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Student fetched successfully",
        data: result,
    });
});

const getStudentCounts = catchAsync(async (_req: Request, res: Response) => {
    const result = await UserService.getStudentCounts();

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Student counts fetched successfully",
        data: result,
    });
});

const getStudentOverview = catchAsync(async (req: Request, res: Response) => {
    const result = await StudentDetailService.getStudentOverview(req.params.userId as string);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Student overview fetched successfully",
        data: result,
    });
});

const getStudentCourse = catchAsync(async (req: Request, res: Response) => {
    const result = await StudentDetailService.getStudentCourse(
        req.params.userId as string,
        req.params.courseId as string,
    );

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Student course progress fetched successfully",
        data: result,
    });
});

const getMentors = catchAsync(async (req: Request, res: Response) => {
    const result = await UserService.getMentors(req.query as IQueryParams);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Mentors fetched successfully",
        data: result.data,
        meta: result.meta,
    });
});

const getMentorById = catchAsync(async (req: Request, res: Response) => {
    const result = await UserService.getMentorById(req.params.mentorId as string);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Mentor fetched successfully",
        data: result,
    });
});

const getMentorOverview = catchAsync(async (req: Request, res: Response) => {
    const result = await MentorDetailService.getMentorOverview(req.params.mentorId as string);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Mentor overview fetched successfully",
        data: result,
    });
});

const getMentorActivity = catchAsync(async (req: Request, res: Response) => {
    const result = await MentorDetailService.getMentorActivity(req.params.mentorId as string, req.query);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Mentor activity fetched successfully",
        data: result.data,
        meta: result.meta,
    });
});

const getMentorReviews = catchAsync(async (req: Request, res: Response) => {
    const { data, meta, courses } = await MentorDetailService.getMentorReviews(req.params.mentorId as string, req.query);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Mentor reviews fetched successfully",
        data: { reviews: data, courses },
        meta,
    });
});

const getMentorDevices = catchAsync(async (req: Request, res: Response) => {
    const result = await MentorDetailService.getMentorDevices(req.user, req.params.mentorId as string);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Mentor devices fetched successfully",
        data: result,
    });
});

const getPublicMentors = catchAsync(async (_req: Request, res: Response) => {
    const result = await UserService.getPublicMentors();

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Mentors fetched successfully",
        data: result,
    });
});

const createMentor = catchAsync(async (req: Request, res: Response) => {
    const result = await UserService.createMentor(req.user, req.body);

    sendResponse(res, {
        httpStatusCode: status.CREATED,
        success: true,
        // An existing account keeps its own password, so the admin
        // needs to know the temporary one they typed was not applied.
        message: result.linkedExistingAccount
            ? "Existing account linked as a mentor. They sign in with their current password."
            : "Mentor account created successfully",
        data: result,
    });
});

const updateMentor = catchAsync(async (req: Request, res: Response) => {
    const result = await UserService.updateMentor(req.user, req.params.mentorId as string, req.body);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Mentor updated successfully",
        data: result,
    });
});

const updateMentorPhoto = catchAsync(async (req: Request, res: Response) => {
    if (!req.file) {
        throw new AppError(status.BAD_REQUEST, "No photo was uploaded.");
    }

    const result = await UserService.updateMentorPhoto(req.user, req.params.mentorId as string, req.file);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Mentor photo updated",
        data: result,
    });
});

const changeUserStatus = catchAsync(async (req: Request, res: Response) => {
    const result = await UserService.changeUserStatus(
        req.user,
        req.params.userId as string,
        req.body.status,
    );

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: `Account status changed to ${req.body.status}`,
        data: result,
    });
});

const changeUserRole = catchAsync(async (req: Request, res: Response) => {
    const result = await UserService.changeUserRole(
        req.user,
        req.params.userId as string,
        req.body.role,
    );

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: `Role changed to ${req.body.role}`,
        data: result,
    });
});

const resetUserPassword = catchAsync(async (req: Request, res: Response) => {
    const result = await UserService.resetUserPassword(req.user, req.params.userId as string);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: `A link to choose a new password has been emailed to ${result.sentTo}.`,
        data: result,
    });
});

const getAdmins = catchAsync(async (req: Request, res: Response) => {
    const result = await UserService.getAdmins(req.query as IQueryParams);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Admins fetched successfully",
        data: result.data,
        meta: result.meta,
    });
});

/** A super admin adding an administrator (temporary password, changed at first sign-in). */
const createAdmin = catchAsync(async (req: Request, res: Response) => {
    const result = await UserService.createAdmin(req.user, req.body);
    sendResponse(res, {
        httpStatusCode: status.CREATED,
        success: true,
        message: "Admin created. They sign in with the temporary password and choose their own.",
        data: result,
    });
});

const exportStudents = catchAsync(async (req: Request, res: Response) => {
    sendCsv(res, "students", await UserService.exportStudents(req.query as IQueryParams));
});

export const UserController = {
    createAdmin,
    exportStudents,
    getStudents,
    getStudentById,
    getStudentCounts,
    getStudentOverview,
    getStudentCourse,
    getMentors,
    getMentorById,
    getMentorOverview,
    getMentorActivity,
    getMentorReviews,
    getMentorDevices,
    getPublicMentors,
    createMentor,
    updateMentor,
    updateMentorPhoto,
    changeUserStatus,
    changeUserRole,
    resetUserPassword,
    getAdmins,
};
