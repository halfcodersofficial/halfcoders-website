import { z } from "zod";

/**
 * Shared field rules for every form on Half Coders.
 *
 * These deliberately mirror the Zod schemas the API validates against
 * (`server/src/app/module/**\/*.validation.ts`). Keeping the two in step is the
 * whole point: a rule that only exists on the server produces a red toast after
 * a round trip, and a rule that only exists here lets a request through that
 * bounces. Every message is written to name the *specific* problem — "Password
 * must be at least 8 characters", never "Invalid input".
 *
 * Form state stays as strings throughout (that is what an `<input>` holds), so
 * nothing here transforms its value. Numbers are converted at the point of
 * submit, where the API shape is being built anyway.
 */

/* ------------------------------------------------------------------ people */

export const nameField = z
    .string()
    .trim()
    .min(1, "Full name is required")
    .min(2, "Full name must be at least 2 characters")
    .max(80, "Full name must be at most 80 characters");

export const emailField = z
    .string()
    .trim()
    .min(1, "Email address is required")
    .email("Email address is invalid — it should look like you@example.com")
    .max(254, "Email address is too long");

/**
 * Bangladeshi mobile numbers: 01XXXXXXXXX, optionally prefixed with +88. Same
 * expression the API uses, so a number accepted here is accepted there.
 */
const BD_PHONE = /^(?:\+?88)?01[3-9]\d{8}$/;

export const phoneField = z
    .string()
    .trim()
    .min(1, "Phone number is required")
    .regex(BD_PHONE, "Enter a Bangladeshi mobile number, e.g. 01712345678");

/** Optional phone: blank is fine, but a half-typed number is not. */
export const optionalPhoneField = z
    .string()
    .trim()
    .refine((value) => value === "" || BD_PHONE.test(value), {
        message: "Enter a Bangladeshi mobile number, e.g. 01712345678",
    });

/* ---------------------------------------------------------------- password */

/**
 * Each rule is shown live under the password box as the student types, so the
 * label has to read as an instruction on its own.
 */
export const PASSWORD_RULES = [
    { id: "length", label: "At least 8 characters", test: (v: string) => v.length >= 8 },
    { id: "lower", label: "One lowercase letter (a–z)", test: (v: string) => /[a-z]/.test(v) },
    { id: "upper", label: "One uppercase letter (A–Z)", test: (v: string) => /[A-Z]/.test(v) },
    { id: "number", label: "One number (0–9)", test: (v: string) => /[0-9]/.test(v) },
] as const;

/** Not required by the API — passing these is what lifts a password to Strong. */
const PASSWORD_BONUSES = [
    (v: string) => v.length >= 12,
    (v: string) => /[^A-Za-z0-9]/.test(v),
] as const;

export type PasswordStrengthLevel = "Weak" | "Medium" | "Strong";

export interface PasswordStrength {
    level: PasswordStrengthLevel;
    /** 0–4, for the meter. */
    score: number;
    rules: { id: string; label: string; passed: boolean }[];
    /** The first unmet requirement, for the message under the field. */
    firstUnmet?: string;
}

export const passwordStrength = (value: string): PasswordStrength => {
    const rules = PASSWORD_RULES.map((rule) => ({
        id: rule.id,
        label: rule.label,
        passed: rule.test(value),
    }));

    const met = rules.filter((rule) => rule.passed).length;
    const bonuses = PASSWORD_BONUSES.filter((test) => test(value)).length;

    // A password that fails any required rule can't be more than Weak, however
    // long it is — the API would reject it either way, so calling it "Medium"
    // would be a lie the submit button then contradicts.
    let level: PasswordStrengthLevel = "Weak";
    let score = met;

    if (met === rules.length) {
        level = bonuses > 0 ? "Strong" : "Medium";
        score = bonuses > 0 ? 4 : 3;
    } else {
        score = Math.min(met, 2);
    }

    return { level, score, rules, firstUnmet: rules.find((rule) => !rule.passed)?.label };
};

/** New-password field. The messages name the exact missing rule. */
export const passwordField = z
    .string()
    .min(1, "Password is required")
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password must be at most 128 characters")
    .regex(/[a-z]/, "Password must include a lowercase letter")
    .regex(/[A-Z]/, "Password must include an uppercase letter")
    .regex(/[0-9]/, "Password must include a number");

/** Sign-in only — the rules were enforced when the password was chosen. */
export const currentPasswordField = z.string().min(1, "Password is required");

/* --------------------------------------------------------------- one-time */

export const otpField = z
    .string()
    .trim()
    .min(1, "Enter the code from your email")
    .regex(/^\d+$/, "The code is digits only")
    .length(6, "The verification code is 6 digits");

/* ------------------------------------------------------------------- links */

export const urlField = (message = "Enter a full link starting with https://") =>
    z.string().trim().min(1, "This link is required").url(message);

export const optionalUrlField = (message = "Enter a full link starting with https://") =>
    z
        .string()
        .trim()
        .refine((value) => value === "" || z.string().url().safeParse(value).success, { message });

/**
 * The API accepts any string and extracts the video id itself, but catching a
 * non-YouTube paste here saves a round trip and explains what went wrong.
 */
const YOUTUBE = /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|live\/|shorts\/)|youtu\.be\/)([\w-]{11})/;

export const youtubeUrlField = z
    .string()
    .trim()
    .min(1, "YouTube link is required")
    .refine((value) => YOUTUBE.test(value), {
        message: "That isn't a YouTube link — paste one like https://youtu.be/W6NZfCO5SIk",
    });

export const optionalYoutubeUrlField = z
    .string()
    .trim()
    .refine((value) => value === "" || YOUTUBE.test(value), {
        message: "That isn't a YouTube link — paste one like https://youtu.be/W6NZfCO5SIk",
    });

export const extractYoutubeId = (value: string): string | null =>
    YOUTUBE.exec(value.trim())?.[1] ?? null;

/* ------------------------------------------------------------------- time */

/** "18:42" or "1:04:07", the way a duration reads on YouTube. */
export const optionalDurationField = z
    .string()
    .trim()
    .refine((value) => value === "" || /^(\d{1,2}:)?[0-5]?\d:[0-5]\d$/.test(value), {
        message: "Duration must look like 18:42 or 1:04:07",
    });

/** 24-hour wall-clock time from an `<input type="time">`. */
export const timeField = z
    .string()
    .trim()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Time must be in 24-hour HH:mm format, e.g. 19:00");

/** Local "YYYY-MM-DDTHH:mm" from an `<input type="datetime-local">`. */
export const dateTimeField = z
    .string()
    .trim()
    .min(1, "Pick a date and time")
    .refine((value) => !Number.isNaN(new Date(value).getTime()), {
        message: "That date and time isn't valid",
    });

export const optionalDateTimeField = z
    .string()
    .trim()
    .refine((value) => value === "" || !Number.isNaN(new Date(value).getTime()), {
        message: "That date and time isn't valid",
    });

/* ----------------------------------------------------------------- numbers */

interface NumericOptions {
    /** What the field is called, so the message can name it. */
    label: string;
    min?: number;
    max?: number;
    /** Reject "12.5" as well as "abc". Defaults to true — the API stores integers. */
    integer?: boolean;
}

/**
 * A number typed into an `<input type="number">`, kept as a string so the field
 * round-trips exactly what was typed (including an empty box, which `Number("")`
 * would silently turn into 0).
 */
export const numericField = ({ label, min, max, integer = true }: NumericOptions) =>
    z
        .string()
        .trim()
        .min(1, `${label} is required`)
        .superRefine((value, ctx) => {
            const parsed = Number(value);

            if (!Number.isFinite(parsed)) {
                ctx.addIssue({ code: "custom", message: `${label} must be a number` });
                return;
            }
            if (integer && !Number.isInteger(parsed)) {
                ctx.addIssue({ code: "custom", message: `${label} must be a whole number` });
                return;
            }
            if (min !== undefined && parsed < min) {
                ctx.addIssue({ code: "custom", message: `${label} can't be lower than ${min}` });
            }
            if (max !== undefined && parsed > max) {
                ctx.addIssue({
                    code: "custom",
                    message: `${label} can't be higher than ${max.toLocaleString()}`,
                });
            }
        });

/** Same, but an empty box means "not set" rather than an error. */
export const optionalNumericField = (options: NumericOptions) =>
    z
        .string()
        .trim()
        .superRefine((value, ctx) => {
            if (value === "") return;
            const result = numericField(options).safeParse(value);
            result.error?.issues.forEach((issue) =>
                ctx.addIssue({ code: "custom", message: issue.message }),
            );
        });

/* ------------------------------------------------------------------- text */

/** A required free-text field, with its own name in every message. */
export const textField = ({
    label,
    min = 1,
    max,
}: {
    label: string;
    min?: number;
    max?: number;
}) => {
    let schema = z
        .string()
        .trim()
        .min(1, `${label} is required`);

    if (min > 1) schema = schema.min(min, `${label} must be at least ${min} characters`);
    if (max !== undefined) {
        schema = schema.max(max, `${label} must be at most ${max} characters`);
    }
    return schema;
};

/** Optional free text — only the length ceiling applies. */
export const optionalTextField = ({ label, max }: { label: string; max?: number }) => {
    const schema = z.string().trim();
    return max === undefined
        ? schema
        : schema.max(max, `${label} must be at most ${max} characters`);
};

/** A `<select>` whose empty option isn't an acceptable answer. */
export const selectField = (message: string) => z.string().trim().min(1, message);

/* ------------------------------------------------------------------ helper */

/**
 * Flattens a Zod error into `{ "path.to.field": "message" }`. Issues without a
 * path — the cross-field `.refine()`s — land under `_form` and render above the
 * submit button, since there is no single input to blame.
 */
export const FORM_ERROR_KEY = "_form";

export const collectIssues = (error: z.ZodError): Record<string, string> => {
    const errors: Record<string, string> = {};

    for (const issue of error.issues) {
        const key = issue.path.length > 0 ? issue.path.join(".") : FORM_ERROR_KEY;
        // First issue wins: it's the one describing the earliest broken rule,
        // which is the one worth acting on first.
        if (!(key in errors)) errors[key] = issue.message;
    }

    return errors;
};
