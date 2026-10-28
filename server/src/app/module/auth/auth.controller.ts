import { Request, Response } from "express";
import status from "http-status";
import AppError from "../../errorHelpers/AppError";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { IRequestUser } from "../../interfaces/requestUser.interface";
import { ensureLearningProfile } from "../../lib/learningProfile";
import { clearSessionCookie, endSession, resolveRequestSession, startSession } from "../../lib/session";
import { AuthService } from "./auth.service";

/** Signs `userId` in on this browser and answers with their profile (plus `extra`). */
const signIn = async (req: Request, res: Response, userId: string, message: string, extra?: Record<string, unknown>) => {
    await ensureLearningProfile(userId);
    const sessionId = await startSession(res, req, userId);
    const me = await AuthService.getMe({ userId, sessionId } as IRequestUser);
    sendResponse(res, { httpStatusCode: status.OK, success: true, message, data: { ...me, ...extra } });
};

const register = catchAsync(async (req: Request, res: Response) => {
    const result = await AuthService.register(req.body);
    sendResponse(res, {
        httpStatusCode: status.CREATED,
        success: true,
        message: "Account created. We've emailed you a code to verify your email.",
        data: result,
    });
});

const verifyEmail = catchAsync(async (req: Request, res: Response) => {
    const userId = await AuthService.verifyEmail(req.body);
    await signIn(req, res, userId, "Email verified — you're signed in.");
});

const resendVerification = catchAsync(async (req: Request, res: Response) => {
    await AuthService.resendVerification(req.body);
    sendResponse(res, { httpStatusCode: status.OK, success: true, message: "If that email needs verifying, a new code is on its way.", data: null });
});

const login = catchAsync(async (req: Request, res: Response) => {
    const userId = await AuthService.login(req.body);
    await signIn(req, res, userId, "Signed in.");
});

/** `isNewAccount` tells the web app whether to greet a new member or a returning one. */
const googleSignIn = catchAsync(async (req: Request, res: Response) => {
    const { userId, isNewAccount } = await AuthService.googleSignIn(req.body);
    await signIn(req, res, userId, isNewAccount ? "Account created — you're signed in." : "Signed in.", { isNewAccount });
});

/** Ends this browser's session, if it has one, and clears the cookie either way. */
const logout = catchAsync(async (req: Request, res: Response) => {
    const result = await resolveRequestSession(req).catch(() => null);
    if (result?.ok) await endSession(result.identity.sessionId);
    clearSessionCookie(res);
    sendResponse(res, { httpStatusCode: status.OK, success: true, message: "Signed out.", data: null });
});

const listDevices = catchAsync(async (req: Request, res: Response) => {
    const result = await AuthService.listDevices(req.user);
    sendResponse(res, { httpStatusCode: status.OK, success: true, message: "Devices fetched successfully", data: result });
});

const signOutDevice = catchAsync(async (req: Request, res: Response) => {
    await AuthService.signOutDevice(req.user, req.params.sessionId as string);
    sendResponse(res, { httpStatusCode: status.OK, success: true, message: "That device has been signed out.", data: null });
});

const signOutOtherDevices = catchAsync(async (req: Request, res: Response) => {
    const result = await AuthService.signOutOtherDevices(req.user);
    sendResponse(res, { httpStatusCode: status.OK, success: true, message: "Your other devices have been signed out.", data: result });
});

const forgotPassword = catchAsync(async (req: Request, res: Response) => {
    await AuthService.forgotPassword(req.body);
    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "If an account uses that email, a reset code is on its way.",
        data: null,
    });
});

const resetPassword = catchAsync(async (req: Request, res: Response) => {
    const userId = await AuthService.resetPassword(req.body);
    await signIn(req, res, userId, "Password changed — you're signed in.");
});

const changePassword = catchAsync(async (req: Request, res: Response) => {
    await AuthService.changePassword(req.user, req.body);
    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Password changed. Your other devices have been signed out.",
        data: null,
    });
});

const getMe = catchAsync(async (req: Request, res: Response) => {
    const result = await AuthService.getMe(req.user);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Profile fetched successfully",
        data: result,
    });
});

const updateProfile = catchAsync(async (req: Request, res: Response) => {
    const result = await AuthService.updateProfile(req.user, req.body);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Profile updated successfully",
        data: result,
    });
});

const updateAvatar = catchAsync(async (req: Request, res: Response) => {
    if (!req.file) {
        throw new AppError(status.BAD_REQUEST, "No image file was uploaded.");
    }

    const result = await AuthService.updateAvatar(req.user, req.file);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Profile photo updated",
        data: result,
    });
});

const updatePreferences = catchAsync(async (req: Request, res: Response) => {
    const result = await AuthService.updatePreferences(req.user, req.body);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Preferences updated successfully",
        data: result,
    });
});

export const AuthController = {
    register,
    verifyEmail,
    resendVerification,
    login,
    googleSignIn,
    logout,
    listDevices,
    signOutDevice,
    signOutOtherDevices,
    forgotPassword,
    resetPassword,
    changePassword,
    getMe,
    updateProfile,
    updateAvatar,
    updatePreferences,
};
