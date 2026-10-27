/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextFunction, Request, RequestHandler, Response } from "express";

/**
 * Wraps an async handler so a rejected promise reaches the global error
 * handler instead of becoming an unhandled rejection.
 */
export const catchAsync = (fn: RequestHandler) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        try {
            await fn(req, res, next);
        } catch (error: any) {
            next(error);
        }
    };
};
