/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextFunction, Request, Response } from "express";
import status from "http-status";
import multer from "multer";
import z from "zod";
import { Prisma } from "../../generated/prisma/client";
import { isDevelopment } from "../config/env";
import AppError from "../errorHelpers/AppError";
import {
    handlePrismaClientInitializationError,
    handlePrismaClientKnownRequestError,
    handlePrismaClientRustPanicError,
    handlePrismaClientUnknownError,
    handlePrismaClientValidationError,
} from "../errorHelpers/handlePrismaErrors";
import { handleZodError } from "../errorHelpers/handleZodError";
import { TErrorSources } from "../interfaces/error.interface";
import { logger } from "../utils/logger";

/**
 * Transient pg / pgbouncer connection failures. These are not bugs — the right
 * answer is 503 + Retry-After so callers and the reverse proxy back off.
 */
const isConnectionError = (err: any): boolean =>
    err?.code === "ECONNRESET" ||
    err?.code === "ETIMEDOUT" ||
    err?.code === "ENOTFOUND" ||
    ["57P01", "57P02", "57P03", "08006", "08000", "08001", "08003", "08004"].includes(err?.code) ||
    (typeof err?.message === "string" &&
        (err.message.includes("Connection terminated unexpectedly") ||
            err.message.includes("Connection terminated due to connection timeout") ||
            err.message.includes("timeout exceeded when trying to connect") ||
            err.message.includes("Client has encountered a connection error")));

/** Multer's own limits, as the person uploading should read them. */
const MULTER_MESSAGES: Partial<Record<multer.ErrorCode, string>> = {
    LIMIT_FILE_SIZE: "Each file must be 5 MB or smaller.",
    LIMIT_FILE_COUNT: "That's too many files at once.",
    LIMIT_UNEXPECTED_FILE: "That's too many files at once, or a file in the wrong field.",
};

export const globalErrorHandler = (err: any, req: Request, res: Response, _next: NextFunction) => {
    // An upload over a limit is the uploader's to fix, not a server fault.
    if (err instanceof multer.MulterError) {
        err = new AppError(status.BAD_REQUEST, MULTER_MESSAGES[err.code] ?? "That upload couldn't be accepted.");
    }
    // 4xx AppErrors are intentional rejections (missing auth, not found,
    // validation) — not application bugs. Logging every one at ERROR level
    // floods production logs with routine traffic and drowns out real failures.
    const isExpectedClientError = err instanceof AppError && err.statusCode >= 400 && err.statusCode < 500;
    if (err instanceof z.ZodError) {
        // A rejected payload, not a bug — and its user-facing wording hides the
        // detail a developer needs, so log the raw issues (code, path, expected).
        logger.warn("Validation failed", {
            method: req.method,
            path: req.originalUrl,
            userId: req.user?.userId ?? null,
            issues: err.issues,
        });
    } else if (isExpectedClientError) {
        // The method, path and caller are the whole diagnosis for a 401/403/404:
        // "You do not have permission to access this resource." on its own says
        // a rejection happened but not which route refused whom, which is no
        // help at all when the culprit is one over-tight role list.
        logger.warn("Request rejected", {
            name: err?.name,
            message: err?.message,
            statusCode: err.statusCode,
            method: req.method,
            path: req.originalUrl,
            // Populated only once checkAuth has resolved the session, so a
            // rejection *before* that point correctly shows as anonymous.
            userId: req.user?.userId ?? null,
            role: req.user?.role ?? "anonymous",
        });
    } else {
        logger.error("Error caught", err);
    }

    // Never try to write a second time if a handler already started streaming.
    if (res.headersSent) {
        return;
    }

    let statusCode: number = status.INTERNAL_SERVER_ERROR;
    let message = "Internal Server Error";
    let errorSources: TErrorSources[] = [];
    let stack: string | undefined;

    if (err instanceof Prisma.PrismaClientKnownRequestError) {
        const simplified = handlePrismaClientKnownRequestError(err);
        statusCode = simplified.statusCode as number;
        message = simplified.message;
        errorSources = simplified.errorSources;
        stack = err.stack;
    } else if (err instanceof Prisma.PrismaClientValidationError) {
        const simplified = handlePrismaClientValidationError();
        statusCode = simplified.statusCode as number;
        message = simplified.message;
        errorSources = simplified.errorSources;
        stack = err.stack;
    } else if (err instanceof Prisma.PrismaClientInitializationError) {
        const simplified = handlePrismaClientInitializationError();
        statusCode = simplified.statusCode as number;
        message = simplified.message;
        errorSources = simplified.errorSources;
        stack = err.stack;
    } else if (err instanceof Prisma.PrismaClientRustPanicError) {
        const simplified = handlePrismaClientRustPanicError();
        statusCode = simplified.statusCode as number;
        message = simplified.message;
        errorSources = simplified.errorSources;
        stack = err.stack;
    } else if (err instanceof Prisma.PrismaClientUnknownRequestError) {
        const simplified = handlePrismaClientUnknownError();
        statusCode = simplified.statusCode as number;
        message = simplified.message;
        errorSources = simplified.errorSources;
        stack = err.stack;
    } else if (err instanceof z.ZodError) {
        const simplified = handleZodError(err);
        statusCode = simplified.statusCode as number;
        message = simplified.message;
        errorSources = simplified.errorSources;
        stack = err.stack;
    } else if (err instanceof AppError) {
        statusCode = err.statusCode;
        message = err.message;
        stack = err.stack;
        errorSources = [{ path: "", message: err.message }];
    } else if (err instanceof Error) {
        // Raw Error messages may leak internals — only show them in dev.
        message = isDevelopment ? err.message : "Internal Server Error";
        stack = err.stack;
        errorSources = [{ path: "", message }];
    }

    // AppError / Zod messages are authored for end users and are safe to send
    // in production. Everything else is masked.
    const isIntentionalError = err instanceof AppError || err instanceof z.ZodError;

    const errorResponse: Record<string, unknown> = {
        success: false,
        message: isDevelopment || isIntentionalError ? message : "An error occurred. Please try again later.",
        errorSources: isDevelopment ? errorSources : [],
        stack: isDevelopment ? stack : undefined,
    };

    if (err instanceof AppError && err.data !== undefined) {
        errorResponse.data = err.data;
    }

    // Final override: Prisma wraps transient connection failures in its own
    // error classes, so this must run *after* the instanceof branches above.
    if (isConnectionError(err)) {
        statusCode = status.SERVICE_UNAVAILABLE;
        errorResponse.message = "Database connection lost. Please retry.";
        res.setHeader("Retry-After", "2");
    }

    res.status(statusCode).json(errorResponse);
};
