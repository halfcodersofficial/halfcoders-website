import z from "zod";

export const createHiredRecordZodSchema = z.object({
    companyName: z.string().trim().min(1, "Company name is required").max(160),
    position: z.string().trim().min(1, "Position is required").max(160),
    jobType: z.string().trim().max(40).optional(),
    howGotJob: z.string().trim().max(255).optional(),
    description: z.string().trim().max(2000).optional(),
    companyCountry: z.string().trim().max(80).optional(),
    companyCity: z.string().trim().max(80).optional(),
    isCurrentlyWorking: z.boolean().optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    careerImpactNote: z.string().trim().max(2000).optional(),
    appointmentLetterUrl: z.string().trim().max(500).optional(),
});

export const updateHiredRecordZodSchema = z.object({
    companyName: z.string().trim().min(1).max(160).optional(),
    position: z.string().trim().min(1).max(160).optional(),
    jobType: z.string().trim().max(40).optional(),
    howGotJob: z.string().trim().max(255).optional(),
    description: z.string().trim().max(2000).optional(),
    companyCountry: z.string().trim().max(80).optional(),
    companyCity: z.string().trim().max(80).optional(),
    isCurrentlyWorking: z.boolean().optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    careerImpactNote: z.string().trim().max(2000).optional(),
    appointmentLetterUrl: z.string().trim().max(500).optional(),
});
