import z from "zod";
import { SubmissionStatus } from "../../../generated/prisma/enums";

/**
 * One late window: a first submission after the deadline but by `until` can
 * score at most `maxMarks`. Ordering against the deadline, the other windows
 * and the total marks is checked in the service, which knows all three.
 */
const lateTier = z.object({
    until: z.coerce.date(),
    maxMarks: z.number().int().min(0).max(1000),
});

export const createAssignmentZodSchema = z.object({
    milestoneId: z.string().trim().min(1, "Milestone is required"),
    title: z.string().trim().min(3, "Title must be at least 3 characters").max(200),
    description: z.string().trim().min(10, "Describe what the student has to do"),
    instructions: z.string().trim().max(5000).optional(),
    attachments: z.array(z.string().url()).max(10).optional(),
    totalMarks: z.number().int().min(1).max(1000).optional(),
    /// ISO timestamp. Omit for an assignment that stays open indefinitely.
    deadline: z.coerce.date().optional(),
    lateTiers: z.array(lateTier).max(10).optional(),
    order: z.number().int().min(1).max(50).optional(),
    isPublished: z.boolean().optional(),
    /// Auto-publish at this time — must be in the future (see applyReleaseRules).
    releaseAt: z.coerce.date().nullable().optional(),
});

export const updateAssignmentZodSchema = z.object({
    title: z.string().trim().min(3).max(200).optional(),
    description: z.string().trim().min(10).optional(),
    /// Null clears it — the editor sends that for an emptied field.
    instructions: z.string().trim().max(5000).nullable().optional(),
    attachments: z.array(z.string().url()).max(10).optional(),
    totalMarks: z.number().int().min(1).max(1000).optional(),
    deadline: z.coerce.date().nullable().optional(),
    lateTiers: z.array(lateTier).max(10).optional(),
    isPublished: z.boolean().optional(),
    releaseAt: z.coerce.date().nullable().optional(),
});

/** A week's assignments in their new order — the complete list. */
export const reorderAssignmentsZodSchema = z.object({
    orderedIds: z.array(z.string().trim().min(1)).min(1, "Provide at least one id"),
});

export const submitAssignmentZodSchema = z
    .object({
        content: z.string().trim().max(20000).optional(),
        submissionUrl: z.string().url("Enter a valid link").optional(),
        fileUrls: z.array(z.string().url()).max(10).optional(),
    })
    // An empty submission is almost always a mis-click, and it would otherwise
    // sit in the mentor's review queue with nothing to review.
    .refine(
        (data) => Boolean(data.content || data.submissionUrl || (data.fileUrls?.length ?? 0) > 0),
        { message: "Add your work: write an answer, paste a link, or attach a file" },
    );

/** A whole rubric, in order; an empty list removes it. */
export const setRubricZodSchema = z.object({
    criteria: z
        .array(
            z.object({
                id: z.string().trim().min(1).optional(),
                title: z.string().trim().min(2, "Name each line").max(160),
                description: z.string().trim().max(500).optional(),
                maxPoints: z.number().int().min(1, "Each line is worth at least 1 mark").max(1000),
            }),
        )
        .max(20, "Keep a rubric to 20 lines or fewer"),
});

export const claimSubmissionZodSchema = z.object({ takeOver: z.boolean().optional() });

export const reviewSubmissionZodSchema = z
    .object({
        status: z.enum([
            SubmissionStatus.ACCEPTED,
            SubmissionStatus.NEEDS_REVISION,
            SubmissionStatus.REJECTED,
        ]),
        score: z.number().int().min(0).max(1000).optional(),
        feedback: z.string().trim().max(5000).optional(),
        /** Points on each line of the assignment's rubric — the score is their sum. */
        rubric: z
            .array(
                z.object({
                    criterionId: z.string().trim().min(1),
                    points: z.number().int().min(0).max(1000),
                    comment: z.string().trim().max(500).optional(),
                }),
            )
            .max(30)
            .optional(),
    })
    .refine(
        (data) => data.status !== SubmissionStatus.ACCEPTED || data.score !== undefined || data.rubric !== undefined,
        { path: ["score"], message: "Give a score when accepting a submission" },
    )
    // Sending work back without saying why leaves the student with nothing to
    // act on.
    .refine(
        (data) =>
            (data.status !== SubmissionStatus.NEEDS_REVISION &&
                data.status !== SubmissionStatus.REJECTED) ||
            Boolean(data.feedback),
        { path: ["feedback"], message: "Explain what needs fixing when returning a submission" },
    );
