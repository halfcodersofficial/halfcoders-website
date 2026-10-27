import z from "zod";
import { BundlePricing } from "../../../generated/prisma/enums";

const courseIds = z
    .array(z.string().trim().min(1))
    .min(2, "A bundle needs at least two courses")
    .max(20, "A bundle can hold up to 20 courses")
    .refine((ids) => new Set(ids).size === ids.length, "Each course can be in the bundle once");

const fields = {
    title: z.string().trim().min(3, "Give the bundle a name").max(120),
    description: z.string().trim().max(2000).nullable().optional(),
    thumbnail: z.string().url().nullable().optional(),
    pricing: z.enum(BundlePricing),
    price: z.number().int().min(1, "A fixed price is at least ৳1").max(10_000_000).nullable().optional(),
    discountPercent: z.number().int().min(1, "Take at least 1% off").max(90, "Up to 90% off").nullable().optional(),
    isActive: z.boolean().optional(),
    startsAt: z.coerce.date().nullable().optional(),
    endsAt: z.coerce.date().nullable().optional(),
    order: z.number().int().min(0).max(1000).optional(),
    courseIds,
};

const priced = (data: { pricing?: BundlePricing; price?: number | null; discountPercent?: number | null }) =>
    data.pricing === undefined ||
    (data.pricing === BundlePricing.FIXED ? typeof data.price === "number" : typeof data.discountPercent === "number");
const windowInOrder = (data: { startsAt?: Date | null; endsAt?: Date | null }) => !data.startsAt || !data.endsAt || data.endsAt > data.startsAt;

export const createBundleZodSchema = z
    .object(fields)
    .refine(priced, { path: ["price"], message: "Set the bundle's price or its discount" })
    .refine(windowInOrder, { path: ["endsAt"], message: "It must end after it starts" });

export const updateBundleZodSchema = z
    .object({ ...fields, title: fields.title.optional(), pricing: fields.pricing.optional(), courseIds: courseIds.optional() })
    .refine(priced, { path: ["price"], message: "Set the bundle's price or its discount" })
    .refine(windowInOrder, { path: ["endsAt"], message: "It must end after it starts" });

export const refundBundleZodSchema = z.object({ reason: z.string().trim().max(500).optional() });
