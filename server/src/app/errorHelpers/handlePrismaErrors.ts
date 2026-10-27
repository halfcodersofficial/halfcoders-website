import status from "http-status";
import { Prisma } from "../../generated/prisma/client";
import { TErrorResponse, TErrorSources } from "../interfaces/error.interface";

/**
 * Prisma reports the columns behind a constraint in `meta`. Render them as a
 * readable field list ("email", or "courseId, order") for the error message.
 */
const metaTargetToFields = (meta: unknown): string => {
    const target = (meta as { target?: unknown } | undefined)?.target;
    if (Array.isArray(target)) return target.join(", ");
    if (typeof target === "string") return target;
    return "field";
};

export const handlePrismaClientKnownRequestError = (
    err: Prisma.PrismaClientKnownRequestError,
): TErrorResponse => {
    let statusCode: number = status.BAD_REQUEST;
    let message = "Database request failed";
    const errorSources: TErrorSources[] = [];

    switch (err.code) {
        // Unique constraint violation.
        case "P2002": {
            const fields = metaTargetToFields(err.meta);
            statusCode = status.CONFLICT;
            message = `A record with this ${fields} already exists`;
            errorSources.push({ path: fields, message });
            break;
        }
        // Foreign key constraint failed — the referenced row doesn't exist.
        case "P2003": {
            const field = (err.meta as { field_name?: string } | undefined)?.field_name ?? "reference";
            statusCode = status.BAD_REQUEST;
            message = "Referenced record does not exist";
            errorSources.push({ path: field, message });
            break;
        }
        // Constraint (e.g. check / NOT NULL) failed.
        case "P2004":
            message = "A database constraint rejected this operation";
            errorSources.push({ path: "", message });
            break;
        // Required relation violation.
        case "P2014":
            message = "This change would break a required relation between records";
            errorSources.push({ path: "", message });
            break;
        // Record not found (update/delete on a missing row).
        case "P2025": {
            const cause = (err.meta as { cause?: string } | undefined)?.cause;
            statusCode = status.NOT_FOUND;
            message = cause ?? "Record not found";
            errorSources.push({ path: "", message });
            break;
        }
        default:
            errorSources.push({ path: "", message: `Prisma error ${err.code}` });
            break;
    }

    return { success: false, statusCode, message, errorSources };
};

export const handlePrismaClientValidationError = (): TErrorResponse => ({
    success: false,
    statusCode: status.BAD_REQUEST,
    message: "Invalid data supplied to the database query",
    errorSources: [{ path: "", message: "Invalid query arguments" }],
});

export const handlePrismaClientUnknownError = (): TErrorResponse => ({
    success: false,
    statusCode: status.INTERNAL_SERVER_ERROR,
    message: "An unexpected database error occurred",
    errorSources: [{ path: "", message: "Unknown database error" }],
});

export const handlePrismaClientInitializationError = (): TErrorResponse => ({
    success: false,
    statusCode: status.SERVICE_UNAVAILABLE,
    message: "Could not connect to the database. Please try again shortly.",
    errorSources: [{ path: "", message: "Database initialization failed" }],
});

export const handlePrismaClientRustPanicError = (): TErrorResponse => ({
    success: false,
    statusCode: status.INTERNAL_SERVER_ERROR,
    message: "The database engine crashed while handling this request",
    errorSources: [{ path: "", message: "Query engine panic" }],
});
