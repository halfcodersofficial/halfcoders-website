import { NextFunction, Request, Response } from "express";
import z from "zod";

/**
 * Parses `req.body` against a Zod schema and replaces it with the parsed
 * result, so handlers downstream see only sanitised, typed data. Validation
 * failures are handed to the global error handler, which renders them as 400s.
 *
 * Multipart requests send their JSON payload in a `data` field alongside the
 * files, so unwrap that first.
 */
export const validateRequest = (zodSchema: z.ZodTypeAny) => {
    return (req: Request, _res: Response, next: NextFunction) => {
        if (req.body?.data) {
            try {
                req.body = JSON.parse(req.body.data);
            } catch {
                return next(new z.ZodError([{
                    code: "custom",
                    path: ["data"],
                    message: "The form data couldn't be read. Please try again.",
                }]));
            }
        }

        const parsed = zodSchema.safeParse(req.body);

        if (!parsed.success) {
            return next(parsed.error);
        }

        req.body = parsed.data;
        next();
    };
};

/** Same, but for `req.query` — used by list endpoints with rich filters. */
export const validateQuery = (zodSchema: z.ZodTypeAny) => {
    return (req: Request, _res: Response, next: NextFunction) => {
        const parsed = zodSchema.safeParse(req.query);
        if (!parsed.success) {
            return next(parsed.error);
        }
        next();
    };
};
