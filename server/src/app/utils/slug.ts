import { prisma } from "../lib/prisma";

/**
 * Latin transliteration is not attempted for Bangla titles — those collapse to
 * an empty string, so the caller gets a stable `course-<n>` fallback rather
 * than a slug of stripped punctuation.
 */
const baseSlugify = (input: string): string =>
    input
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, "")
        .replace(/[\s_-]+/g, "-")
        .replace(/^-+|-+$/g, "");

/**
 * Builds a URL-safe slug that is unique across courses. If the natural slug is
 * taken, appends `-2`, `-3`, … until it isn't.
 *
 * `excludeId` lets an update keep its own slug: without it, renaming a course
 * to its existing title would collide with itself and bump to `-2`.
 */
export const generateCourseSlug = async (title: string, excludeId?: string): Promise<string> => {
    const base = baseSlugify(title) || "course";

    let candidate = base;
    let suffix = 1;

    // Bounded loop: each miss increments the suffix, so this terminates as soon
    // as it reaches an unused value.
    for (;;) {
        const existing = await prisma.course.findUnique({
            where: { slug: candidate },
            select: { id: true },
        });

        if (!existing || existing.id === excludeId) return candidate;

        suffix += 1;
        candidate = `${base}-${suffix}`;
    }
};

export const generateCategorySlug = async (title: string, excludeId?: string): Promise<string> => {
    const base = baseSlugify(title) || "category";

    let candidate = base;
    let suffix = 1;

    for (;;) {
        const existing = await prisma.courseCategory.findUnique({
            where: { slug: candidate },
            select: { id: true },
        });

        if (!existing || existing.id === excludeId) return candidate;

        suffix += 1;
        candidate = `${base}-${suffix}`;
    }
};

/** Words the bundle routes use for themselves (`/bundles/manage`, `/bundles/orders/…`). */
const RESERVED_BUNDLE_SLUGS = new Set(["manage", "orders"]);

export const generateBundleSlug = async (title: string, excludeId?: string): Promise<string> => {
    const natural = baseSlugify(title) || "bundle";
    const base = RESERVED_BUNDLE_SLUGS.has(natural) ? `${natural}-bundle` : natural;

    let candidate = base;
    let suffix = 1;

    for (;;) {
        const existing = await prisma.courseBundle.findUnique({
            where: { slug: candidate },
            select: { id: true },
        });

        if (!existing || existing.id === excludeId) return candidate;

        suffix += 1;
        candidate = `${base}-${suffix}`;
    }
};

export const slugify = baseSlugify;
