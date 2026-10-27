import z from "zod";

export const createCourseRequestZodSchema = z.object({
    courseName: z.string().trim().min(1, "Course name is required").max(160),
    category: z.string().trim().max(80).optional(),
});
