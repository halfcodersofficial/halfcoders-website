import z from "zod";
import { CouponKind } from "../../../generated/prisma/enums";

const code = z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9-]{3,32}$/, "Use 3–32 letters, numbers or dashes, e.g. EID-25");

const taka = (message: string) => z.number().int().min(1, message).max(10_000_000);

const fields = {
    label: z.string().trim().max(80, "Keep the label under 80 characters").nullable().optional(),
    description: z.string().trim().max(300).nullable().optional(),
    kind: z.enum(CouponKind),
    value: taka("Take at least 1 off"),
    maxDiscount: taka("The cap must be at least ৳1").nullable().optional(),
    minAmount: taka("The minimum must be at least ৳1").nullable().optional(),
    allCourses: z.boolean().optional(),
    courseIds: z.array(z.string().trim().min(1)).max(500).optional(),
    maxRedemptions: z.number().int().min(1, "Allow at least one use").max(1_000_000).nullable().optional(),
    perStudentLimit: z.number().int().min(1, "Allow each student at least one use").max(1000).nullable().optional(),
    startsAt: z.coerce.date().nullable().optional(),
    endsAt: z.coerce.date().nullable().optional(),
    isActive: z.boolean().optional(),
};

const percentInRange = (data: { kind?: CouponKind; value?: number }) => data.kind !== CouponKind.PERCENT || data.value === undefined || data.value <= 100;
const windowInOrder = (data: { startsAt?: Date | null; endsAt?: Date | null }) => !data.startsAt || !data.endsAt || data.endsAt > data.startsAt;
const coursesChosen = (data: { allCourses?: boolean; courseIds?: string[] }) => data.allCourses !== false || data.courseIds === undefined || data.courseIds.length > 0;

export const createCouponZodSchema = z
    .object({ code, ...fields })
    .refine(percentInRange, { path: ["value"], message: "A percentage can't be more than 100" })
    .refine(windowInOrder, { path: ["endsAt"], message: "It must end after it starts" })
    .refine(coursesChosen, { path: ["courseIds"], message: "Pick at least one course, or make it for every course" });

export const updateCouponZodSchema = z
    .object({ code: code.optional(), ...fields, kind: fields.kind.optional(), value: fields.value.optional() })
    .refine(percentInRange, { path: ["value"], message: "A percentage can't be more than 100" })
    .refine(windowInOrder, { path: ["endsAt"], message: "It must end after it starts" })
    .refine(coursesChosen, { path: ["courseIds"], message: "Pick at least one course, or make it for every course" });

export const applyCouponZodSchema = z.object({ code: z.string().trim().min(1, "Enter a code").max(32) });

export const checkCouponQuerySchema = z.object({
    code: z.string().trim().min(1, "Enter a code").max(32),
    courseId: z.string().trim().min(1).optional(),
});
