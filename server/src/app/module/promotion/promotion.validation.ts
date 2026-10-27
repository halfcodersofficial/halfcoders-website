import z from "zod";
import { RewardCondition } from "../../../generated/prisma/enums";

const courseIds = z
    .array(z.string().trim().min(1))
    .min(1, "Choose at least one course")
    .max(10, "Up to 10 courses")
    .refine((ids) => new Set(ids).size === ids.length, "Each course once");

export const saveOfferZodSchema = z
    .object({
        courseIds,
        isActive: z.boolean().default(true),
        startsAt: z.coerce.date().nullable().optional(),
        endsAt: z.coerce.date().nullable().optional(),
    })
    .refine((data) => !data.startsAt || !data.endsAt || data.endsAt > data.startsAt, {
        path: ["endsAt"],
        message: "It must end after it starts",
    });

export const saveRewardZodSchema = z.object({
    courseIds,
    condition: z.enum(RewardCondition),
    deadlineAt: z.coerce.date().nullable().optional(),
    withinDays: z.number().int().min(1, "At least 1 day").max(730, "Up to 2 years").nullable().optional(),
    isActive: z.boolean().default(true),
});
