import { Request, Response } from "express";
import status from "http-status";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { QuizService } from "./quiz.service";

// ---------------------------------------------------------------------------
// Authoring
// ---------------------------------------------------------------------------

const createQuiz = catchAsync(async (req: Request, res: Response) => {
    const result = await QuizService.createQuiz(req.user, req.body);
    sendResponse(res, {
        httpStatusCode: status.CREATED,
        success: true,
        message: "Quiz created successfully",
        data: result,
    });
});

const updateQuiz = catchAsync(async (req: Request, res: Response) => {
    const result = await QuizService.updateQuiz(req.user, req.params.quizId as string, req.body);
    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Quiz updated successfully",
        data: result,
    });
});

const deleteQuiz = catchAsync(async (req: Request, res: Response) => {
    await QuizService.deleteQuiz(req.user, req.params.quizId as string);
    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Quiz deleted successfully",
        data: null,
    });
});

const getQuizResults = catchAsync(async (req: Request, res: Response) => {
    const result = await QuizService.getQuizResults(req.user, req.params.quizId as string);
    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Quiz results fetched successfully",
        data: result,
    });
});

const getQuizForModule = catchAsync(async (req: Request, res: Response) => {
    const result = await QuizService.getQuizForModule(req.user, req.params.moduleId as string);
    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Quiz fetched successfully",
        data: result,
    });
});

const createQuestion = catchAsync(async (req: Request, res: Response) => {
    const result = await QuizService.createQuestion(req.user, req.params.quizId as string, req.body);
    sendResponse(res, {
        httpStatusCode: status.CREATED,
        success: true,
        message: "Question added successfully",
        data: result,
    });
});

const updateQuestion = catchAsync(async (req: Request, res: Response) => {
    const result = await QuizService.updateQuestion(req.user, req.params.questionId as string, req.body);
    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Question updated successfully",
        data: result,
    });
});

const deleteQuestion = catchAsync(async (req: Request, res: Response) => {
    await QuizService.deleteQuestion(req.user, req.params.questionId as string);
    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Question deleted successfully",
        data: null,
    });
});

const reorderQuestions = catchAsync(async (req: Request, res: Response) => {
    const result = await QuizService.reorderQuestions(
        req.user,
        req.params.quizId as string,
        req.body.orderedIds,
    );
    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Questions reordered successfully",
        data: result,
    });
});

// ---------------------------------------------------------------------------
// Student
// ---------------------------------------------------------------------------

const getQuizForStudent = catchAsync(async (req: Request, res: Response) => {
    const result = await QuizService.getQuizForStudent(req.user, req.params.quizId as string);
    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Quiz fetched successfully",
        data: result,
    });
});

const submitQuiz = catchAsync(async (req: Request, res: Response) => {
    const result = await QuizService.submitQuiz(req.user, req.params.quizId as string, req.body);
    sendResponse(res, {
        httpStatusCode: status.CREATED,
        success: true,
        message: "Quiz submitted",
        data: result,
    });
});

const getAttempt = catchAsync(async (req: Request, res: Response) => {
    const result = await QuizService.getAttempt(req.user, req.params.attemptId as string);
    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Attempt fetched successfully",
        data: result,
    });
});

const getMyAttempts = catchAsync(async (req: Request, res: Response) => {
    const result = await QuizService.getMyAttempts(req.user, req.params.quizId as string);
    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Attempts fetched successfully",
        data: result,
    });
});

export const QuizController = {
    getQuizResults,
    createQuiz,
    updateQuiz,
    deleteQuiz,
    getQuizForModule,
    createQuestion,
    updateQuestion,
    deleteQuestion,
    reorderQuestions,
    getQuizForStudent,
    submitQuiz,
    getAttempt,
    getMyAttempts,
};
