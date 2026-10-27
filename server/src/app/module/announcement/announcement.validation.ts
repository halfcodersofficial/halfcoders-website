import z from "zod";

export const createAnnouncementZodSchema = z.object({
    title: z.string().trim().min(3, "Give it a title of at least 3 characters").max(160),
    body: z.string().trim().min(3, "Write what you want to say").max(5000),
    isPinned: z.boolean().optional(),
});

export const updateAnnouncementZodSchema = z
    .object({
        title: z.string().trim().min(3).max(160).optional(),
        body: z.string().trim().min(3).max(5000).optional(),
        isPinned: z.boolean().optional(),
    })
    .refine((data) => Object.keys(data).length > 0, { message: "Nothing to change" });
