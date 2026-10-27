import z from "zod";
import { CourseReviewStatus } from "../../../generated/prisma/enums";

export const upsertReviewZodSchema = z.object({
    rating: z.number().int().min(1, "Pick 1 to 5 stars").max(5, "Pick 1 to 5 stars"),
    comment: z.string().trim().max(2000).optional(),
});

export const moderateReviewZodSchema = z.object({ status: z.enum(CourseReviewStatus) });
