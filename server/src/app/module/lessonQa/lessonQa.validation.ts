import z from "zod";

const body = z.string().trim().min(3, "Write at least a few words").max(3000);

export const askZodSchema = z.object({ body });
export const answerZodSchema = z.object({ body });
export const resolveZodSchema = z.object({ isResolved: z.boolean() });
