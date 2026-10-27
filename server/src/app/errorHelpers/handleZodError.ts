import status from "http-status";
import z from "zod";
import { TErrorResponse, TErrorSources } from "../interfaces/error.interface";

export const handleZodError = (err: z.ZodError): TErrorResponse => {
    const errorSources: TErrorSources[] = err.issues.map((issue) => ({
        path: issue.path.join(" => "),
        message: issue.message,
    }));

    // Surface the first concrete issue as the top-level message — clients that
    // only read `message` would otherwise show a useless generic label.
    return {
        success: false,
        message: errorSources[0]?.message ?? "Validation error",
        errorSources,
        statusCode: status.BAD_REQUEST,
    };
};
