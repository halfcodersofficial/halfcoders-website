import z from "zod";
import { LearningStatus } from "../../../generated/prisma/enums";
import { Role } from "../../lib/roles";

const phone = z
    .string()
    .trim()
    .regex(/^(?:\+?88)?01[3-9]\d{8}$/, "Please enter a valid Bangladeshi mobile number");

/**
 * Granting the mentor role (plan §20). If the email already belongs to a
 * student, that account is made a mentor and `password`/`phone` are ignored —
 * its owner keeps their own credentials. Otherwise the account is created with
 * this temporary password and flagged `needPasswordChange`, so the mentor
 * replaces it on first sign-in.
 */
export const createAdminZodSchema = z.object({
    name: z.string().trim().min(2, "Name must be at least 2 characters").max(80),
    email: z.string().trim().toLowerCase().email("Please enter a valid email address"),
    password: z
        .string()
        .min(8, "Password must be at least 8 characters")
        .max(128)
        .regex(/[a-z]/, "Password must include a lowercase letter")
        .regex(/[A-Z]/, "Password must include an uppercase letter")
        .regex(/[0-9]/, "Password must include a number"),
    phone: phone.optional(),
});

export const createMentorZodSchema = z.object({
    name: z.string().trim().min(2, "Name must be at least 2 characters").max(80),
    email: z.string().trim().toLowerCase().email("Please enter a valid email address"),
    password: z
        .string()
        .min(8, "Password must be at least 8 characters")
        .max(128)
        .regex(/[a-z]/, "Password must include a lowercase letter")
        .regex(/[A-Z]/, "Password must include an uppercase letter")
        .regex(/[0-9]/, "Password must include a number"),
    phone: phone.optional(),
    image: z.string().url().optional(),
    bio: z.string().trim().max(2000).optional(),
    designation: z.string().trim().max(120).optional(),
    expertise: z.array(z.string().trim().min(1).max(60)).max(20).optional(),
    experience: z.string().trim().max(255).optional(),
    facebookUrl: z.string().url().optional(),
    linkedinUrl: z.string().url().optional(),
    githubUrl: z.string().url().optional(),
    websiteUrl: z.string().url().optional(),
    isFeatured: z.boolean().optional(),
});

/** Email and phone belong to the account holder, so an admin can't change them from here. */
export const updateMentorZodSchema = createMentorZodSchema
    .omit({ password: true, email: true, phone: true })
    .partial();


/** Learning-only access; the account itself is unaffected. */
export const changeUserStatusZodSchema = z.object({
    status: z.enum(LearningStatus),
});

export const changeUserRoleZodSchema = z.object({
    // Only between student and mentor. Admins are added by a super admin
    // (POST /users/admins); super admins come from `pnpm seed:admin`.
    role: z.enum([Role.STUDENT, Role.MENTOR]),
});
