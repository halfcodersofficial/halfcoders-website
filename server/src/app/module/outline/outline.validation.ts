import z from "zod";
import { CLASS_MODES } from "../../utils/courseMode";

/// NO_MODULE is bootcamp only — see `assertFitsCourseType`.
const kind = z.enum(["MODULE", "PRACTICE", "NO_MODULE"]);

/// Online or offline — only on a course that runs both (`assertCanMarkMode`).
/// Null clears it back to "not marked".
const classMode = z.enum(CLASS_MODES, "Choose online or offline").nullable().optional();

/** An emptied field clears the value rather than being ignored. */
const optionalText = (max: number) =>
    z
        .string()
        .trim()
        .max(max)
        .transform((value) => value || null);

export const createOutlineWeekZodSchema = z.object({
    courseId: z.string().trim().min(1, "Course is required"),
    title: optionalText(160).optional(),
});

export const updateOutlineWeekZodSchema = z.object({
    title: optionalText(160).nullable().optional(),
});

export const reorderOutlineWeeksZodSchema = z.object({
    /// The complete ordered list — same contract as the milestone reorder.
    orderedIds: z.array(z.string().trim().min(1)).min(1, "Provide at least one id"),
});

/// Every item in the week, in the new order. See `reorderItems` for what that means for dates.
export const reorderOutlineItemsZodSchema = reorderOutlineWeeksZodSchema;

export const createOutlineItemZodSchema = z.object({
    weekId: z.string().trim().min(1, "Week is required"),
    kind: kind.default("MODULE"),
    title: z.string().trim().min(2, "Title must be at least 2 characters").max(200),
    note: optionalText(500).optional(),
    /// Bootcamp only. Null or omitted reads as "date to be announced".
    scheduledAt: z.coerce.date().nullable().optional(),
    /// Traditional only — see `assertFitsCourseType`.
    isPublished: z.boolean().optional(),
    mode: classMode,
});

/// Traditional only. Omit the week to publish every draft in the outline.
export const publishAllOutlineItemsZodSchema = z.object({
    weekId: z.string().trim().min(1).optional(),
});

export const updateOutlineItemZodSchema = z.object({
    /// Moves the item to another week of the same course.
    weekId: z.string().trim().min(1).optional(),
    kind: kind.optional(),
    title: z.string().trim().min(2).max(200).optional(),
    note: optionalText(500).nullable().optional(),
    scheduledAt: z.coerce.date().nullable().optional(),
    isPublished: z.boolean().optional(),
    mode: classMode,
});
