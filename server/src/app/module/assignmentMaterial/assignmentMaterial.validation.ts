import z from "zod";
import { materialCreateFields, materialReorderZodSchema, materialUpdateZodSchema, requireFieldForType } from "../../utils/lessonMaterial";

export const createAssignmentMaterialZodSchema = z
    .object({
        assignmentId: z.string().trim().min(1, "Assignment is required"),
        ...materialCreateFields,
    })
    .superRefine(requireFieldForType);

/** The type is fixed once created; a field of another type is refused in the service. */
export const updateAssignmentMaterialZodSchema = materialUpdateZodSchema;

export const reorderAssignmentMaterialsZodSchema = materialReorderZodSchema;
