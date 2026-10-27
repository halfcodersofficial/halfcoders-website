import z from "zod";

export const createSkillZodSchema = z.object({
    name: z.string().trim().min(1, "Skill name is required").max(80),
    yearsOfExperience: z.string().trim().max(20).optional(),
    projectLink: z.string().trim().max(500).optional(),
});

export const updateSkillZodSchema = z.object({
    name: z.string().trim().min(1).max(80).optional(),
    yearsOfExperience: z.string().trim().max(20).optional(),
    projectLink: z.string().trim().max(500).optional(),
});
