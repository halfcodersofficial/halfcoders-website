import z from "zod";
import { materialCreateFields, materialReorderZodSchema, materialUpdateZodSchema, requireFieldForType } from "../../utils/lessonMaterial";

export const createPracticeMaterialZodSchema = z
    .object({
        practiceDayId: z.string().trim().min(1, "Practice day is required"),
        ...materialCreateFields,
    })
    .superRefine(requireFieldForType);

/** The type is fixed once created; a field of another type is refused in the service. */
export const updatePracticeMaterialZodSchema = materialUpdateZodSchema;

export const reorderPracticeMaterialsZodSchema = materialReorderZodSchema;
