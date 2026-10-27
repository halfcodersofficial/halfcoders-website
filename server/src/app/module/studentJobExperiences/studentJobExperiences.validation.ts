import z from "zod";

export const createJobExperienceZodSchema = z.object({
    designation: z.string().trim().min(1, "Designation is required").max(160),
    companyName: z.string().trim().min(1, "Company name is required").max(160),
    isRelatedToIt: z.boolean().optional(),
    description: z.string().trim().max(2000).optional(),
    isCurrentlyWorking: z.boolean().optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
});

export const updateJobExperienceZodSchema = z.object({
    designation: z.string().trim().min(1).max(160).optional(),
    companyName: z.string().trim().min(1).max(160).optional(),
    isRelatedToIt: z.boolean().optional(),
    description: z.string().trim().max(2000).optional(),
    isCurrentlyWorking: z.boolean().optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
});
