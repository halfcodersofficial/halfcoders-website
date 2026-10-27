import { NextFunction, Request, Response } from "express";
import status from "http-status";
import { Role } from "../lib/roles";
import AppError from "../errorHelpers/AppError";
import { IRequestUser } from "../interfaces/requestUser.interface";
import { resolveRequestSession, SessionFailure, SessionIdentity } from "../lib/session";

/**
 * Machine-readable reason attached to every 401/403 from here, so the client
 * can tell "send them to sign in" apart from "signed in, but not allowed on
 * Half Coders" — redirecting a blocked learner to the sign-in page would just
 * bounce them straight back.
 */
const FAILURES: Record<SessionFailure, { status: number; message: string }> = {
    NO_CREDENTIAL: { status: status.UNAUTHORIZED, message: "You must be signed in to do that." },
    INVALID_SESSION: {
        status: status.UNAUTHORIZED,
        message: "Your session is invalid or has expired. Please sign in again.",
    },
    ACCOUNT_INACTIVE: {
        status: status.FORBIDDEN,
        message: "Your account is not active. Please contact support.",
    },
    ACCOUNT_UNVERIFIED: {
        status: status.FORBIDDEN,
        message: "Please verify your email address before using Half Coders.",
    },
    LEARNING_BLOCKED: {
        status: status.FORBIDDEN,
        message: "Your Half Coders access has been blocked. Please contact support.",
    },
    LEARNING_REMOVED: {
        status: status.FORBIDDEN,
        message: "Your Half Coders access has been removed. Please contact support.",
    },
};

export const authFailure = (reason: SessionFailure) => {
    const { status: code, message } = FAILURES[reason];
    return new AppError(code, message).setData({ code: reason });
};

/** `req.user` for a resolved session. */
export const toRequestUser = (identity: SessionIdentity): IRequestUser => ({
    userId: identity.userId,
    sessionId: identity.sessionId,
    name: identity.name,
    email: identity.email,
    role: identity.role,
});

/**
 * Resolves the caller from their session and, when roles are supplied,
 * enforces that they hold one of them. Populates `req.user`.
 *
 * Call with no arguments to require *any* signed-in Half Coders member.
 */
export const checkAuth =
    (...authRoles: Role[]) =>
        async (req: Request, _res: Response, next: NextFunction) => {
            try {
                const result = await resolveRequestSession(req);

                if (!result.ok) {
                    return next(authFailure(result.reason));
                }

                const { identity } = result;

                if (authRoles.length > 0 && !authRoles.includes(identity.role)) {
                    return next(
                        new AppError(status.FORBIDDEN, "You do not have permission to access this resource.")
                            .setData({ code: "FORBIDDEN_ROLE" }),
                    );
                }

                req.user = toRequestUser(identity);

                next();
            } catch (error) {
                next(error);
            }
        };
