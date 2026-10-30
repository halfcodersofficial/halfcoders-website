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

/** Reward courses with a main course: to students picked by hand (one or a group), or to everyone who has it. */
export const giveRewardCoursesZodSchema = z
    .object({
        courseIds,
        audience: z.enum(["STUDENTS", "EVERYONE"]),
        studentIds: z.array(z.string().trim().min(1)).max(500, "Up to 500 students at a time").optional(),
    })
    .refine((data) => data.audience === "EVERYONE" || (data.studentIds?.length ?? 0) > 0, {
        path: ["studentIds"],
        message: "Pick at least one student",
    });

export const setRewardForEveryoneZodSchema = z.object({ forEveryone: z.boolean() });

export const saveRewardZodSchema = z.object({
    courseIds,
    condition: z.enum(RewardCondition),
    deadlineAt: z.coerce.date().nullable().optional(),
    withinDays: z.number().int().min(1, "At least 1 day").max(730, "Up to 2 years").nullable().optional(),
    isActive: z.boolean().default(true),
});
