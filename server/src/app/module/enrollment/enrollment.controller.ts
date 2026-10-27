import { Request, Response } from "express";
import status from "http-status";
import { IQueryParams } from "../../interfaces/query.interface";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { EnrollmentService } from "./enrollment.service";
import { sendCsv } from "../../utils/csvExport";

const getMyEnrollments = catchAsync(async (req: Request, res: Response) => {
    const result = await EnrollmentService.getMyEnrollments(req.user, req.query as IQueryParams);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Enrolled courses fetched successfully",
        data: result.data,
        meta: result.meta,
    });
});

const getMyEnrollment = catchAsync(async (req: Request, res: Response) => {
    const result = await EnrollmentService.getMyEnrollment(req.user, req.params.courseId as string);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Enrolment fetched successfully",
        data: result,
    });
});

const getAllEnrollments = catchAsync(async (req: Request, res: Response) => {
    const result = await EnrollmentService.getAllEnrollments(req.query as IQueryParams);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Enrolments fetched successfully",
        data: result.data,
        meta: result.meta,
    });
});

const getEnrollmentCourses = catchAsync(async (_req: Request, res: Response) => {
    const result = await EnrollmentService.getEnrollmentCourses();

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Enrolment courses fetched successfully",
        data: result,
    });
});

const getEnrollmentCourse = catchAsync(async (req: Request, res: Response) => {
    const result = await EnrollmentService.getEnrollmentCourse(req.params.courseId as string);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Enrolment course fetched successfully",
        data: result,
    });
});

const enrollStudentManually = catchAsync(async (req: Request, res: Response) => {
    const result = await EnrollmentService.enrollStudentManually(req.body);

    sendResponse(res, {
        httpStatusCode: status.CREATED,
        success: true,
        message: "Student enrolled successfully",
        data: result,
    });
});

const cancelEnrollment = catchAsync(async (req: Request, res: Response) => {
    const result = await EnrollmentService.cancelEnrollment(req.params.enrollmentId as string);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Enrolment cancelled",
        data: result,
    });
});

const reactivateEnrollment = catchAsync(async (req: Request, res: Response) => {
    const result = await EnrollmentService.reactivateEnrollment(req.params.enrollmentId as string);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Enrolment reactivated",
        data: result,
    });
});

const getCourseStudents = catchAsync(async (req: Request, res: Response) => {
    const result = await EnrollmentService.getCourseStudents(
        req.user,
        req.params.courseId as string,
        req.query as IQueryParams,
    );

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Students fetched successfully",
        data: result.data,
        meta: result.meta,
    });
});

const exportEnrollments = catchAsync(async (req: Request, res: Response) => {
    sendCsv(res, "enrolments", await EnrollmentService.exportEnrollments(req.query as IQueryParams));
});

export const EnrollmentController = {
    exportEnrollments,
    getMyEnrollments,
    getCourseStudents,
    getMyEnrollment,
    getAllEnrollments,
    getEnrollmentCourses,
    getEnrollmentCourse,
    enrollStudentManually,
    cancelEnrollment,
    reactivateEnrollment,
};
