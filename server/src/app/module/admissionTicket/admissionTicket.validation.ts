import z from "zod";

const text = (max: number) => z.string().trim().max(max, `Up to ${max} characters`);

/** A line the ticket may go without: blank is saved as "not set". */
const optional = (max: number) =>
    text(max)
        .nullable()
        .optional()
        .transform((value) => value || null);

/**
 * One course's ticket. The limits are what the picture has room for — the
 * drawing shrinks a long line to fit, but only so far before it reads small.
 */
export const saveAdmissionTicketZodSchema = z.object({
    isActive: z.boolean().default(true),
    headline: text(32).min(1, "Write the headline"),
    subheadline: optional(70),
    ticketTitle: optional(32),
    badge: optional(24),
    learnerLabel: optional(20),
    courseLabel: optional(20),
    courseName: optional(90),
    fields: z
        .array(z.object({ label: text(20).min(1, "Give it a label"), value: text(60).min(1, "Write what it says") }))
        .max(3, "Up to 3 fields")
        .default([]),
    stubLabel: optional(12),
    stubValue: optional(8),
    showPhoto: z.boolean().default(true),
    taglineLead: optional(40),
    taglineAccent: optional(40),
    footerText: optional(32),
});

export type SaveAdmissionTicketInput = z.infer<typeof saveAdmissionTicketZodSchema>;
