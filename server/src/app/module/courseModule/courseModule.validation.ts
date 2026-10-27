import z from "zod";
import { CLASS_MODES } from "../../utils/courseMode";

/// Online or offline — only on a course that runs both (`assertCanMarkMode`).
/// Null clears it back to "not marked".
const classMode = z.enum(CLASS_MODES, "Choose online or offline").nullable().optional();

export const createModuleZodSchema = z.object({
    milestoneId: z.string().trim().min(1, "Milestone is required"),
    title: z.string().trim().min(3, "Title must be at least 3 characters").max(160),
    description: z.string().trim().max(2000).optional(),
    /// Omit to append after the last module in the milestone.
    order: z.number().int().min(1).max(200).optional(),
    isPublished: z.boolean().optional(),
    /// When set, the release scheduler auto-publishes at this instant instead
    /// of the module going live immediately — see courseModule.service.ts.
    releaseAt: z.coerce.date().nullable().optional(),
    mode: classMode,
});

export const updateModuleZodSchema = z.object({
    title: z.string().trim().min(3).max(160).optional(),
    // Null clears it — the editor sends that for an emptied field.
    description: z.string().trim().max(2000).nullable().optional(),
    isPublished: z.boolean().optional(),
    releaseAt: z.coerce.date().nullable().optional(),
    mode: classMode,
});

export const reorderModulesZodSchema = z.object({
    orderedIds: z.array(z.string().trim().min(1)).min(1, "Provide at least one id"),
});
