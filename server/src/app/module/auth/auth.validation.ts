import z from "zod";
import { BD_MOBILE, normaliseBdMobile } from "../../utils/bkash";

// Bangladeshi mobile numbers, stored as 01XXXXXXXXX whatever the spacing or +88.
const bdPhone = z
    .string()
    .trim()
    .transform(normaliseBdMobile)
    .pipe(z.string().regex(BD_MOBILE, "Please enter a valid Bangladeshi mobile number"));

const email = z.string().trim().toLowerCase().pipe(z.email("Please enter a valid email address").max(254));

/** The rules the sign-up form shows live, enforced again here. */
const newPassword = z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password must be at most 128 characters")
    .regex(/[a-z]/, "Password must include a lowercase letter")
    .regex(/[A-Z]/, "Password must include an uppercase letter")
    .regex(/[0-9]/, "Password must include a number");

const code = z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code from the email");

export const registerZodSchema = z.object({
    name: z.string().trim().min(2, "Full name must be at least 2 characters").max(80),
    email,
    phone: bdPhone,
    password: newPassword,
});

export const verifyEmailZodSchema = z.object({ email, code });

export const emailOnlyZodSchema = z.object({ email });

export const loginZodSchema = z.object({
    email,
    password: z.string().min(1, "Password is required").max(128),
    /** Sent once the person agrees, on the device-limit step, to sign out of every other device. */
    signOutAllDevices: z.boolean().optional(),
});

export const googleSignInZodSchema = z
    .object({
        /** The one-time code from Google's sign-in popup. */
        code: z.string().trim().min(1).max(2048).optional(),
        /** Or a Google ID token — what the device-limit step comes back with. */
        credential: z.string().trim().min(1).max(4096).optional(),
        /** As for `loginZodSchema`: sent once the person agrees on the device-limit step. */
        signOutAllDevices: z.boolean().optional(),
    })
    .refine((body) => Boolean(body.code) !== Boolean(body.credential), "Google sign-in didn't send its code. Please try again.");

export const resetPasswordZodSchema = z.object({ email, code, password: newPassword });

export const changePasswordZodSchema = z.object({
    currentPassword: z.string().min(1, "Current password is required").max(128),
    newPassword,
});

/**
 * Editable from inside the account. The email is not: it's where codes and
 * receipts go, and changing it would need its own verification. The photo is
 * set through the avatar upload endpoint. `.strict()` makes a stale client that
 * still sends something else fail loudly rather than silently dropping it.
 */
export const updateProfileZodSchema = z
    .object({
        name: z.string().trim().min(2).max(80).optional(),
        phone: bdPhone.optional(),
        whatsapp: bdPhone.optional(),
        bio: z.string().trim().max(1000).optional(),
        address: z.string().trim().max(255).optional(),
    })
    .strict();

export const updatePreferencesZodSchema = z.object({
    healthCaution: z.object({
        enabled: z.boolean().optional(),
        intervalMinutes: z.number().int().min(15).max(480).optional(),
        categories: z.object({
            eyeCare: z.boolean().optional(),
            goodPosture: z.boolean().optional(),
            meditation: z.boolean().optional(),
            stretching: z.boolean().optional(),
            screenBreak: z.boolean().optional(),
        }).partial().optional(),
    }).partial().optional(),
    emailPreference: z.boolean().optional(),
});
