import z from "zod";

/** Same limits as module lessons (see video.validation.ts). */
const lessonContent = z.string().trim().min(1, "Write the lesson text").max(50_000);

/** Only http(s) — this lands in an `<a href>` on the student's page. */
const resourceUrl = z
    .string()
    .trim()
    .max(2000)
    .regex(/^https?:\/\/\S+$/i, "Enter a full link starting with https://");

export const createAssignmentMaterialZodSchema = z
    .object({
        assignmentId: z.string().trim().min(1, "Assignment is required"),
        type: z.enum(["VIDEO", "TEXT", "RESOURCE"]),
        title: z.string().trim().min(3, "Title must be at least 3 characters").max(200),
        description: z.string().trim().max(2000).optional(),
        youtubeUrl: z.string().trim().min(1).optional(),
        content: lessonContent.optional(),
        resourceUrl: resourceUrl.optional(),
    })
    .superRefine((lesson, ctx) => {
        if (lesson.type === "VIDEO" && !lesson.youtubeUrl) {
            ctx.addIssue({ code: "custom", path: ["youtubeUrl"], message: "YouTube URL is required" });
        }
        if (lesson.type === "TEXT" && !lesson.content) {
            ctx.addIssue({ code: "custom", path: ["content"], message: "Write the lesson text" });
        }
        if (lesson.type === "RESOURCE" && !lesson.resourceUrl) {
            ctx.addIssue({ code: "custom", path: ["resourceUrl"], message: "Add the resource link" });
        }
    });

/** The type is fixed once created; a field of another type is refused in the service. */
export const updateAssignmentMaterialZodSchema = z.object({
    title: z.string().trim().min(3).max(200).optional(),
    description: z.string().trim().max(2000).optional(),
    youtubeUrl: z.string().trim().min(1).optional(),
    content: lessonContent.optional(),
    resourceUrl: resourceUrl.optional(),
});

export const reorderAssignmentMaterialsZodSchema = z.object({
    orderedIds: z.array(z.string().trim().min(1)).min(1, "Provide at least one id"),
});
