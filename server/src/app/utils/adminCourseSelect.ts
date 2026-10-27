import { Prisma } from "../../generated/prisma/client";

/**
 * The course fields the admin's per-course screens head a list with
 * (Payments, Enrolments): enough for a card — picture, title, price, where
 * it stands — and nothing heavier.
 */
export const adminCourseSelect = {
    id: true,
    title: true,
    slug: true,
    thumbnail: true,
    price: true,
    discountPrice: true,
    status: true,
    courseType: true,
    phase: true,
    pricing: true,
    delivery: true,
    isDeleted: true,
    category: { select: { title: true } },
} satisfies Prisma.CourseSelect;

export type AdminCourseCard = Prisma.CourseGetPayload<{ select: typeof adminCourseSelect }>;
