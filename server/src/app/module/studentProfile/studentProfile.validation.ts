import z from "zod";
import { Gender } from "../../../generated/prisma/enums";

export const additionalInfoZodSchema = z.object({
    gender: z.enum(Gender).optional(),
    ageRange: z.string().trim().max(40).optional(),
    primaryDeviceType: z.string().trim().max(40).optional(),
    internetType: z.string().trim().max(40).optional(),
    yearsOfExperience: z.string().trim().max(40).optional(),
    employmentRole: z.string().trim().max(120).optional(),
    areaType: z.string().trim().max(40).optional(),
});

export const addressZodSchema = z.object({
    presentCountry: z.string().trim().max(80).optional(),
    presentDistrict: z.string().trim().max(80).optional(),
    presentStreetAddress: z.string().trim().max(255).optional(),
    permanentCountry: z.string().trim().max(80).optional(),
    permanentDistrict: z.string().trim().max(80).optional(),
    permanentStreetAddress: z.string().trim().max(255).optional(),
    sameAsPresent: z.boolean().optional(),
});

export const educationZodSchema = z.object({
    level: z.string().trim().max(80).optional(),
    examTitle: z.string().trim().max(160).optional(),
    institutionName: z.string().trim().max(160).optional(),
    passingYear: z.number().int().min(1980).max(2100).optional(),
    isCurrentlyStudying: z.boolean().optional(),
    currentYear: z.string().trim().max(40).optional(),
    isCseStudent: z.boolean().optional(),
});

export const linksZodSchema = z.object({
    cvUrl: z.string().trim().max(500).optional(),
    githubUrl: z.string().trim().max(500).optional(),
    portfolioUrl: z.string().trim().max(500).optional(),
    linkedinUrl: z.string().trim().max(500).optional(),
    profileImageUrl: z.string().trim().max(500).optional(),
});

export const jobProfileZodSchema = z.object({
    wantsJob: z.boolean().optional(),
    jobType: z.string().trim().max(40).optional(),
    jobPreference: z.string().trim().max(40).optional(),
    wantsJobOutsideBangladesh: z.boolean().optional(),
    hasJobExperience: z.boolean().optional(),
});
