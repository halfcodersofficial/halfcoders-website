import z from "zod";

export const createMilestoneZodSchema = z.object({
    courseId: z.string().trim().min(1, "Course is required"),
    title: z.string().trim().min(3, "Title must be at least 3 characters").max(160),
    description: z.string().trim().max(2000).optional(),
    /// Omit to append after the last milestone in the course.
    order: z.number().int().min(1).max(100).optional(),
    isPublished: z.boolean().optional(),
});

export const updateMilestoneZodSchema = z.object({
    title: z.string().trim().min(3).max(160).optional(),
    // Null clears it — the editor sends that for an emptied field.
    description: z.string().trim().max(2000).nullable().optional(),
    isPublished: z.boolean().optional(),
});

/**
 * A week's modules, assignments and practice days in their new mixed order —
 * every item of the week exactly once.
 */
export const reorderWeekItemsZodSchema = z.object({
    items: z
        .array(
            z.object({
                kind: z.enum(["MODULE", "ASSIGNMENT", "PRACTICE"]),
                id: z.string().trim().min(1),
            }),
        )
        .min(1, "Provide at least one item"),
});

export const reorderZodSchema = z.object({
    /// Full ordered list of ids. Sending the complete list (rather than a
    /// single moved item) lets the server apply the new order atomically
    /// without inferring intent from a partial update.
    orderedIds: z.array(z.string().trim().min(1)).min(1, "Provide at least one id"),
});
