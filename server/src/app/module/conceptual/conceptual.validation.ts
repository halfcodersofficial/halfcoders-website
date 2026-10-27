import z from "zod";

const title = z.string().trim().min(3, "Title must be at least 3 characters").max(200);
/** Sent empty to clear it. */
const description = z.string().trim().max(2000);

/** As a lesson's: "1:09:57" the way YouTube shows it, or seconds. */
const duration = z.union([
    z.number().int().min(0).max(24 * 3600),
    z.string().regex(/^(\d{1,2}:)?\d{1,2}:\d{2}$/, "Duration must look like 18:42 or 1:09:57"),
]);

const orderedIds = z.object({
    orderedIds: z.array(z.string().trim().min(1)).min(1, "Provide at least one id"),
});

export const createTopicZodSchema = z.object({
    courseId: z.string().trim().min(1, "Course is required"),
    title,
    description: description.optional(),
    isPublished: z.boolean().optional(),
});

export const updateTopicZodSchema = z.object({
    title: title.optional(),
    description: description.optional(),
    isPublished: z.boolean().optional(),
});

export const reorderZodSchema = orderedIds;

export const createSessionZodSchema = z.object({
    topicId: z.string().trim().min(1, "Topic is required"),
    title,
    youtubeUrl: z.string().trim().min(1, "YouTube link is required"),
    duration: duration.optional(),
    description: description.optional(),
    isPublished: z.boolean().optional(),
});

export const updateSessionZodSchema = z.object({
    title: title.optional(),
    youtubeUrl: z.string().trim().min(1).optional(),
    duration: duration.optional(),
    description: description.optional(),
    isPublished: z.boolean().optional(),
    /** Moves it to the end of another topic of the same course. */
    topicId: z.string().trim().min(1).optional(),
});

export const watchedZodSchema = z.object({
    watched: z.boolean(),
});
