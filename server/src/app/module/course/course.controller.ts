import { Request, Response } from "express";
import status from "http-status";
import AppError from "../../errorHelpers/AppError";
import { IQueryParams } from "../../interfaces/query.interface";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { CourseService } from "./course.service";

const createCourse = catchAsync(async (req: Request, res: Response) => {
    const result = await CourseService.createCourse(req.user, req.body);

    sendResponse(res, {
        httpStatusCode: status.CREATED,
        success: true,
        message: "Course created successfully",
        data: result,
    });
});

const updateCourse = catchAsync(async (req: Request, res: Response) => {
    const result = await CourseService.updateCourse(req.params.courseId as string, req.body, req.user?.userId);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Course updated successfully",
        data: result,
    });
});

const changeCourseStatus = catchAsync(async (req: Request, res: Response) => {
    const result = await CourseService.changeCourseStatus(req.params.courseId as string, req.body.status);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: `Course status changed to ${req.body.status}`,
        data: result,
    });
});

const deleteCourse = catchAsync(async (req: Request, res: Response) => {
    await CourseService.deleteCourse(req.params.courseId as string);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Course deleted successfully",
        data: null,
    });
});

const getPublicCourses = catchAsync(async (req: Request, res: Response) => {
    const result = await CourseService.getPublicCourses(req.query as IQueryParams);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Courses fetched successfully",
        data: result.data,
        meta: result.meta,
    });
});

const getAdminCourses = catchAsync(async (req: Request, res: Response) => {
    const result = await CourseService.getAdminCourses(req.query as IQueryParams);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Courses fetched successfully",
        data: result.data,
        meta: result.meta,
    });
});

const getCourseBySlug = catchAsync(async (req: Request, res: Response) => {
    // `optionalAuth` runs ahead of this, so `req.user` is set only when a
    // valid session was presented.
    const result = await CourseService.getCourseBySlug(req.params.slug as string, req.user);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Course fetched successfully",
        data: result,
    });
});

const getCourseById = catchAsync(async (req: Request, res: Response) => {
    const result = await CourseService.getCourseById(req.params.courseId as string);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Course fetched successfully",
        data: result,
    });
});

const getStaffCourseSummary = catchAsync(async (req: Request, res: Response) => {
    const result = await CourseService.getStaffCourseSummary(
        req.user,
        req.params.courseId as string,
    );

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Course fetched successfully",
        data: result,
    });
});

const getStaffCourse = catchAsync(async (req: Request, res: Response) => {
    const result = await CourseService.getStaffCourse(req.user, req.params.courseId as string);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Course fetched successfully",
        data: result,
    });
});

const getStaffCourseResults = catchAsync(async (req: Request, res: Response) => {
    const result = await CourseService.getStaffCourseResults(req.user, req.params.courseId as string);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Course results fetched successfully",
        data: result,
    });
});

const updateCourseContent = catchAsync(async (req: Request, res: Response) => {
    const result = await CourseService.updateCourseContent(
        req.user,
        req.params.courseId as string,
        req.body,
    );

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Course page updated successfully",
        data: result,
    });
});

const assignMentor = catchAsync(async (req: Request, res: Response) => {
    const result = await CourseService.assignMentor(req.params.courseId as string, req.body, req.user.userId);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Mentor assigned to course",
        data: result,
    });
});

const removeMentor = catchAsync(async (req: Request, res: Response) => {
    await CourseService.removeMentor(req.params.courseId as string, req.params.mentorId as string, req.user.userId);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Mentor removed from course",
        data: null,
    });
});

const uploadCurriculumPdf = catchAsync(async (req: Request, res: Response) => {
    if (!req.file) {
        throw new AppError(status.BAD_REQUEST, "No PDF file was uploaded.");
    }

    // In-memory upload (unlike the rest of this controller) — the curriculum
    // PDF goes to Cloudinary as a private asset, which needs the raw buffer
    // rather than `multerUpload`'s auto-streamed public URL.
    const result = await CourseService.uploadCurriculumPdf(
        req.user,
        req.params.courseId as string,
        req.file.buffer,
        req.file.originalname,
    );

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Curriculum PDF uploaded",
        data: result,
    });
});

const uploadCourseImage = catchAsync(async (req: Request, res: Response) => {
    if (!req.file) {
        throw new AppError(status.BAD_REQUEST, "No image was uploaded.");
    }

    const result = await CourseService.uploadCourseImage(
        req.user,
        req.params.courseId as string,
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype,
    );

    sendResponse(res, {
        httpStatusCode: status.CREATED,
        success: true,
        message: "Image uploaded",
        data: result,
    });
});

const removeCurriculumPdf = catchAsync(async (req: Request, res: Response) => {
    await CourseService.removeCurriculumPdf(req.user, req.params.courseId as string);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Curriculum PDF removed",
        data: null,
    });
});

const downloadCurriculumPdf = catchAsync(async (req: Request, res: Response) => {
    const { buffer, fileName } = await CourseService.downloadCurriculumPdf(req.params.slug as string);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName.replace(/"/g, "")}"`);
    res.setHeader("Content-Length", buffer.length);
    res.send(buffer);
});

export const CourseController = {
    getStaffCourseResults,
    createCourse,
    updateCourse,
    changeCourseStatus,
    deleteCourse,
    getPublicCourses,
    getAdminCourses,
    getCourseBySlug,
    getCourseById,
    getStaffCourseSummary,
    getStaffCourse,
    updateCourseContent,
    assignMentor,
    removeMentor,
    uploadCurriculumPdf,
    removeCurriculumPdf,
    downloadCurriculumPdf,
    uploadCourseImage,
};
