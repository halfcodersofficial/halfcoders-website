import z from "zod";

/**
 * Google Meet is the expected platform (Zoom and others work too) — the link
 * is just stored and handed to enrolled students once the session is live.
 */
const meetingLink = z
    .string()
    .trim()
    .url("Paste the full meeting link, e.g. https://meet.google.com/abc-defg-hij");

export const createSessionZodSchema = z
    .object({
        courseId: z.string().trim().min(1, "Course is required"),
        title: z.string().trim().max(160).optional(),
        meetingLink: meetingLink.optional(),
        startTime: z.coerce.date(),
        endTime: z.coerce.date(),
        /// Minutes budgeted per student. Only drives the *estimated* wait
        /// shown to students — the mentor advances the queue by hand.
        slotMinutes: z.number().int().min(1).max(60).optional(),
        notes: z.string().trim().max(2000).optional(),
        /// Admin-only: which mentor hosts this session. A mentor creating
        /// their own session always hosts it regardless of this field — see
        /// `resolveHostMentorId` in the service.
        mentorId: z.string().trim().min(1).optional(),
    })
    .refine((data) => data.endTime > data.startTime, {
        path: ["endTime"],
        message: "The session must end after it starts",
    });

export const updateSessionZodSchema = z
    .object({
        title: z.string().trim().max(160).optional(),
        meetingLink: meetingLink.nullable().optional(),
        startTime: z.coerce.date().optional(),
        endTime: z.coerce.date().optional(),
        slotMinutes: z.number().int().min(1).max(60).optional(),
        notes: z.string().trim().max(2000).optional(),
        /// Mentor's join cutoff switch — false blocks new sign-ups without
        /// touching `status` or `endTime`.
        joinOpen: z.boolean().optional(),
        /// Admin-only reassignment — see `createSessionZodSchema.mentorId`.
        mentorId: z.string().trim().min(1).optional(),
    })
    // Only checkable here when both are supplied; the service re-checks against
    // the stored row so a PATCH of one field can't invert the window.
    .refine(
        (data) => !data.startTime || !data.endTime || data.endTime > data.startTime,
        { path: ["endTime"], message: "The session must end after it starts" },
    );

export const joinQueueZodSchema = z.object({
    /// What the student wants help with — lets the mentor prepare before
    /// calling their number.
    topic: z.string().trim().max(500).optional(),
});

const score = (what: string) =>
    z
        .number({ error: `Pick a number from 1 to 5 for ${what}` })
        .int()
        .min(1, `Pick a number from 1 to 5 for ${what}`)
        .max(5, `Pick a number from 1 to 5 for ${what}`);

/** A student's feedback on a finished turn: how it went, and how far it solved their problem. */
export const supportFeedbackZodSchema = z.object({
    rating: score("how it went"),
    solved: score("whether it solved your problem"),
});

/** Staff moving one turn by hand — from the attendance record or the board. */
export const queueStatusZodSchema = z.object({
    status: z.enum(["WAITING", "SERVING", "COMPLETED", "SKIPPED", "LEFT"], { error: "Pick a status" }),
    mentorNote: z.string().trim().max(1000).optional(),
});

export const mentorNoteZodSchema = z.object({
    mentorNote: z.string().trim().max(1000).optional(),
});
