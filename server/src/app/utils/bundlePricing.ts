import { BundlePricing } from "../../generated/prisma/enums";

export interface BundleCoursePrice {
    courseId: string;
    title: string;
    /** List price, before the course's own sale. */
    price: number;
    discountPrice: number | null;
}

export interface BundleLine {
    courseId: string;
    title: string;
    /** What the course costs on its own today. */
    salePrice: number;
    /** Already enrolled — not bought again. */
    owned: boolean;
    /** This course's part of the bundle total; 0 for an owned one. */
    share: number;
}

export interface BundleQuote {
    lines: BundleLine[];
    /** Every course at its sale price, added up — what buying them one by one costs. */
    combined: number;
    /** The bundle's price for all of them. */
    bundlePrice: number;
    /** The courses still to buy, at their sale prices. */
    amount: number;
    /** What this student pays: the bundle price, in proportion to what's left to buy. */
    total: number;
    discount: number;
    /** Nothing left to buy — the student owns them all. */
    ownsAll: boolean;
}

const salePriceOf = (course: BundleCoursePrice) => course.discountPrice ?? course.price;

/** The whole bundle's price: the fixed sum, or the combined sale price less the percentage. */
export const bundleListPrice = (
    bundle: { pricing: BundlePricing; price: number | null; discountPercent: number | null },
    combined: number,
) =>
    bundle.pricing === BundlePricing.FIXED
        ? Math.min(bundle.price ?? combined, combined)
        : Math.round((combined * (100 - (bundle.discountPercent ?? 0))) / 100);

/**
 * What a bundle costs one student. A student who already owns some of the
 * courses pays the bundle price in proportion to the rest (by sale price) —
 * never more than those courses cost on their own. The total is then split
 * across the courses being bought, again by sale price, with the rounding
 * left over going to the last, so the shares always add up to the total.
 */
export const quoteBundle = (
    bundle: { pricing: BundlePricing; price: number | null; discountPercent: number | null },
    courses: BundleCoursePrice[],
    ownedCourseIds: ReadonlySet<string>,
): BundleQuote => {
    const combined = courses.reduce((sum, course) => sum + salePriceOf(course), 0);
    const bundlePrice = bundleListPrice(bundle, combined);
    const toBuy = courses.filter((course) => !ownedCourseIds.has(course.courseId));
    const amount = toBuy.reduce((sum, course) => sum + salePriceOf(course), 0);

    const total =
        toBuy.length === courses.length
            ? bundlePrice
            : combined === 0
              ? 0
              : Math.min(amount, Math.round((bundlePrice * amount) / combined));

    // Split the total by sale price; whatever rounding leaves goes on the last.
    const shares = new Map<string, number>();
    let given = 0;
    toBuy.forEach((course, index) => {
        const share =
            index === toBuy.length - 1 ? total - given : amount === 0 ? 0 : Math.floor((total * salePriceOf(course)) / amount);
        shares.set(course.courseId, share);
        given += share;
    });

    return {
        lines: courses.map((course) => ({
            courseId: course.courseId,
            title: course.title,
            salePrice: salePriceOf(course),
            owned: ownedCourseIds.has(course.courseId),
            share: shares.get(course.courseId) ?? 0,
        })),
        combined,
        bundlePrice,
        amount,
        total,
        discount: amount - total,
        ownsAll: toBuy.length === 0,
    };
};
