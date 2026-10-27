import z from "zod";

export const createProjectZodSchema = z.object({
    title: z.string().trim().min(1, "Project title is required").max(160),
    description: z.string().trim().max(1000).optional(),
    url: z.string().trim().min(1, "Project URL is required").max(500),
});

export const updateProjectZodSchema = z.object({
    title: z.string().trim().min(1).max(160).optional(),
    description: z.string().trim().max(1000).optional(),
    url: z.string().trim().min(1).max(500).optional(),
});
