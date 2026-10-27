import { Request, Response } from "express";
import status from "http-status";
import { IQueryParams } from "../../interfaces/query.interface";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { AssignmentService } from "./assignment.service";

const createAssignment = catchAsync(async (req: Request, res: Response) => {
    const result = await AssignmentService.createAssignment(req.user, req.body);

    sendResponse(res, {
        httpStatusCode: status.CREATED,
        success: true,
        message: "Assignment created successfully",
        data: result,
    });
});

const updateAssignment = catchAsync(async (req: Request, res: Response) => {
    const result = await AssignmentService.updateAssignment(
        req.user,
        req.params.assignmentId as string,
        req.body,
    );

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Assignment updated successfully",
        data: result,
    });
});

const reorderAssignments = catchAsync(async (req: Request, res: Response) => {
    const result = await AssignmentService.reorderAssignments(
        req.user,
        req.params.milestoneId as string,
        req.body.orderedIds,
    );
    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Assignments reordered successfully",
        data: result,
    });
});

const deleteAssignment = catchAsync(async (req: Request, res: Response) => {
    await AssignmentService.deleteAssignment(req.user, req.params.assignmentId as string);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Assignment deleted successfully",
        data: null,
    });
});

const getAssignmentForStudent = catchAsync(async (req: Request, res: Response) => {
    const result = await AssignmentService.getAssignmentForStudent(
        req.user,
        req.params.assignmentId as string,
    );

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Assignment fetched successfully",
        data: result,
    });
});

const uploadSubmissionFiles = catchAsync(async (req: Request, res: Response) => {
    const result = await AssignmentService.uploadSubmissionFiles(
        req.user,
        req.params.assignmentId as string,
        (req.files as Express.Multer.File[] | undefined) ?? [],
    );

    sendResponse(res, {
        httpStatusCode: status.CREATED,
        success: true,
        message: "Files uploaded",
        data: result,
    });
});

const submitAssignment = catchAsync(async (req: Request, res: Response) => {
    const result = await AssignmentService.submitAssignment(
        req.user,
        req.params.assignmentId as string,
        req.body,
    );

    sendResponse(res, {
        httpStatusCode: status.CREATED,
        success: true,
        message: "Assignment submitted successfully",
        data: result,
    });
});

const getMySubmissions = catchAsync(async (req: Request, res: Response) => {
    const result = await AssignmentService.getMySubmissions(req.user, req.query as IQueryParams);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Submissions fetched successfully",
        data: result.data,
        meta: result.meta,
    });
});

const getReviewQueueCounts = catchAsync(async (req: Request, res: Response) => {
    const result = await AssignmentService.getReviewQueueCounts(req.user, req.query as IQueryParams);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Review queue counts fetched successfully",
        data: result,
    });
});

const getReviewQueue = catchAsync(async (req: Request, res: Response) => {
    const result = await AssignmentService.getReviewQueue(req.user, req.query as IQueryParams);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Review queue fetched successfully",
        data: result.data,
        meta: result.meta,
    });
});

const getRubric = catchAsync(async (req: Request, res: Response) => {
    const result = await AssignmentService.getRubric(req.user, req.params.assignmentId as string);
    sendResponse(res, { httpStatusCode: status.OK, success: true, message: "Rubric retrieved", data: result });
});

const setRubric = catchAsync(async (req: Request, res: Response) => {
    const result = await AssignmentService.setRubric(req.user, req.params.assignmentId as string, req.body.criteria);
    sendResponse(res, { httpStatusCode: status.OK, success: true, message: "Rubric saved", data: result });
});

const claimSubmission = catchAsync(async (req: Request, res: Response) => {
    const result = await AssignmentService.claimSubmission(req.user, req.params.submissionId as string, req.body?.takeOver === true);
    sendResponse(res, { httpStatusCode: status.OK, success: true, message: "You're reviewing this hand-in", data: result });
});

const releaseSubmission = catchAsync(async (req: Request, res: Response) => {
    const result = await AssignmentService.releaseSubmission(req.user, req.params.submissionId as string);
    sendResponse(res, { httpStatusCode: status.OK, success: true, message: "Back in the queue", data: result });
});

const reviewSubmission = catchAsync(async (req: Request, res: Response) => {
    const result = await AssignmentService.reviewSubmission(
        req.user,
        req.params.submissionId as string,
        req.body,
    );

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Submission reviewed successfully",
        data: result,
    });
});

const getSubmissionById = catchAsync(async (req: Request, res: Response) => {
    const result = await AssignmentService.getSubmissionById(
        req.user,
        req.params.submissionId as string,
    );

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Submission fetched successfully",
        data: result,
    });
});

export const AssignmentController = {
    uploadSubmissionFiles,
    createAssignment,
    updateAssignment,
    reorderAssignments,
    deleteAssignment,
    getAssignmentForStudent,
    submitAssignment,
    getMySubmissions,
    getReviewQueue,
    getReviewQueueCounts,
    reviewSubmission,
    claimSubmission,
    releaseSubmission,
    getRubric,
    setRubric,
    getSubmissionById,
};
