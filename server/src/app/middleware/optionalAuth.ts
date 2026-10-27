import { NextFunction, Request, Response } from "express";
import { resolveRequestSession } from "../lib/session";
import { toRequestUser } from "./checkAuth";

/**
 * Populates `req.user` when a valid session exists and does nothing
 * otherwise.
 *
 * Used by endpoints that serve both visitors and students — e.g. the course
 * details page, which additionally reports whether *you* are already enrolled.
 * Never rejects: an invalid, missing or blocked session simply means
 * "anonymous".
 */
export const optionalAuth = async (req: Request, _res: Response, next: NextFunction) => {
    try {
        const result = await resolveRequestSession(req);

        if (result.ok) {
            req.user = toRequestUser(result.identity);
        }
    } catch {
        // A broken session must not break a public page — fall through as
        // anonymous.
    }

    next();
};
