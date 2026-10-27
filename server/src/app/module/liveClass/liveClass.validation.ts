import z from "zod";

const joinUrl = z.string().trim().url("Paste the full meeting link, starting with https://").max(500).refine((value) => value.startsWith("https://"), {
    message: "The meeting link must start with https://",
});

export const createLiveClassZodSchema = z.object({
    title: z.string().trim().min(3, "Give the class a title of at least 3 characters").max(160),
    description: z.string().trim().max(2000).optional(),
    startsAt: z.coerce.date(),
    durationMinutes: z.number().int().min(15, "A class is at least 15 minutes").max(360, "A class is at most 6 hours").optional(),
    joinUrl: joinUrl.optional(),
    topicId: z.string().trim().min(1).optional(),
});

export const updateLiveClassZodSchema = z
    .object({
        title: z.string().trim().min(3).max(160).optional(),
        description: z.string().trim().max(2000).nullable().optional(),
        startsAt: z.coerce.date().optional(),
        durationMinutes: z.number().int().min(15).max(360).optional(),
        joinUrl: joinUrl.nullable().optional(),
        topicId: z.string().trim().min(1).nullable().optional(),
    })
    .refine((data) => Object.keys(data).length > 0, { message: "Nothing to change" });
