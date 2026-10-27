import z from "zod";

/**
 * Mentors enter duration the way it appears on YouTube ("18:42" or "1:04:07")
 * rather than in seconds, so accept either and normalise in the service.
 */
const duration = z.union([
    z.number().int().min(0).max(24 * 3600),
    z.string().regex(/^(\d{1,2}:)?\d{1,2}:\d{2}$/, "Duration must look like 18:42 or 1:04:07"),
]);

/** Text lessons are written in the editor, so the ceiling is a long article, not a book. */
const lessonContent = z.string().trim().min(1, "Write the lesson text").max(50_000);

/** Only http(s) — this lands in an `<a href>` on the student's page. */
const resourceUrl = z
    .string()
    .trim()
    .max(2000)
    .regex(/^https?:\/\/\S+$/i, "Enter a full link starting with https://");

export const createVideoZodSchema = z
    .object({
        moduleId: z.string().trim().min(1, "Module is required"),
        /// Omit for a video — every lesson was one before the other types existed.
        type: z.enum(["VIDEO", "TEXT", "RESOURCE"]).optional(),
        title: z.string().trim().min(3, "Title must be at least 3 characters").max(200),
        description: z.string().trim().max(2000).optional(),
        youtubeUrl: z.string().trim().min(1).optional(),
        content: lessonContent.optional(),
        resourceUrl: resourceUrl.optional(),
        duration: duration.optional(),
        thumbnail: z.string().url().optional(),
        /// Omit to append after the last lesson in the module.
        order: z.number().int().min(1).max(200).optional(),
        isPublished: z.boolean().optional(),
        isFreePreview: z.boolean().optional(),
    })
    .superRefine((lesson, ctx) => {
        const type = lesson.type ?? "VIDEO";
        if (type === "VIDEO" && !lesson.youtubeUrl) {
            ctx.addIssue({ code: "custom", path: ["youtubeUrl"], message: "YouTube URL is required" });
        }
        if (type === "TEXT" && !lesson.content) {
            ctx.addIssue({ code: "custom", path: ["content"], message: "Write the lesson text" });
        }
        if (type === "RESOURCE" && !lesson.resourceUrl) {
            ctx.addIssue({ code: "custom", path: ["resourceUrl"], message: "Add the resource link" });
        }
        // The public course page plays a preview with the YouTube player;
        // there's nothing to play for any other type.
        if (type !== "VIDEO" && lesson.isFreePreview) {
            ctx.addIssue({ code: "custom", path: ["isFreePreview"], message: "Only video lessons can be free previews" });
        }
    });

/**
 * A lesson's type is fixed once created — changing it would leave the old
 * type's field behind. The service rejects a field that doesn't match the
 * stored type.
 */
export const updateVideoZodSchema = z.object({
    title: z.string().trim().min(3).max(200).optional(),
    description: z.string().trim().max(2000).optional(),
    youtubeUrl: z.string().trim().min(1).optional(),
    content: lessonContent.optional(),
    resourceUrl: resourceUrl.optional(),
    duration: duration.optional(),
    thumbnail: z.string().url().optional(),
    isPublished: z.boolean().optional(),
    isFreePreview: z.boolean().optional(),
});

export const reorderVideosZodSchema = z.object({
    orderedIds: z.array(z.string().trim().min(1)).min(1, "Provide at least one id"),
});

/** Bulk add — mentors typically paste a whole module's worth at once. */
export const bulkCreateVideosZodSchema = z.object({
    moduleId: z.string().trim().min(1, "Module is required"),
    /**
     * Applies to every video in the batch. Defaults to false so a
     * half-prepared module never appears to students mid-upload; pass true to
     * add and publish in one step, which is what a mentor pasting a finished
     * module's links actually wants.
     */
    isPublished: z.boolean().optional(),
    videos: z
        .array(
            z.object({
                title: z.string().trim().min(3).max(200),
                youtubeUrl: z.string().trim().min(1),
                duration: duration.optional(),
                description: z.string().trim().max(2000).optional(),
            }),
        )
        .min(1, "Add at least one video")
        .max(30, "Add at most 30 videos at a time"),
});

/** Publish or unpublish several videos at once. */
export const bulkPublishVideosZodSchema = z.object({
    videoIds: z.array(z.string().trim().min(1)).min(1, "Select at least one video").max(100),
    isPublished: z.boolean(),
});
