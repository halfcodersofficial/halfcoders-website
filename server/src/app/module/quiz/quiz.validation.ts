import z from "zod";

/**
 * One option's authoring shape. `isCorrect` is the only field a mentor
 * actually toggles — `id` is optional so an edit can tell "keep this row" from
 * "this is new" without a separate per-option endpoint (see quiz.service.ts
 * `replaceQuestionOptions`).
 */
const optionInputSchema = z.object({
    id: z.string().trim().min(1).optional(),
    text: z.string().trim().min(1, "An option needs text").max(300),
    isCorrect: z.boolean().optional(),
});

const optionsArray = z
    .array(optionInputSchema)
    .min(2, "A question needs at least 2 options")
    .max(6, "A question can have at most 6 options")
    .refine(
        (options) => options.filter((o) => o.isCorrect).length === 1,
        { message: "Mark exactly one option as correct" },
    );

export const createQuizZodSchema = z.object({
    moduleId: z.string().trim().min(1, "Module is required"),
    title: z.string().trim().min(3, "Title must be at least 3 characters").max(200),
    description: z.string().trim().max(2000).optional(),
});

export const updateQuizZodSchema = z.object({
    title: z.string().trim().min(3).max(200).optional(),
    description: z.string().trim().max(2000).nullable().optional(),
    isPublished: z.boolean().optional(),
});

export const createQuestionZodSchema = z.object({
    question: z.string().trim().min(3, "Question must be at least 3 characters").max(1000),
    explanation: z.string().trim().max(2000).optional(),
    order: z.number().int().min(1).max(200).optional(),
    options: optionsArray,
});

export const updateQuestionZodSchema = z.object({
    question: z.string().trim().min(3).max(1000).optional(),
    explanation: z.string().trim().max(2000).nullable().optional(),
    /** Full replace — see `optionInputSchema` on why partial option edits aren't a separate endpoint. */
    options: optionsArray.optional(),
});

export const reorderQuestionsZodSchema = z.object({
    orderedIds: z.array(z.string().trim().min(1)).min(1, "Provide at least one id"),
});

/**
 * The whole answer sheet in one go — a quiz is answered in full and submitted
 * once. Completeness (every question, once each) is checked in the service,
 * which knows the quiz.
 */
export const submitQuizZodSchema = z.object({
    answers: z
        .array(
            z.object({
                questionId: z.string().trim().min(1, "Question is required"),
                selectedOptionId: z.string().trim().min(1, "Select an option"),
            }),
        )
        .min(1, "Answer the questions before submitting")
        .max(500),
});
