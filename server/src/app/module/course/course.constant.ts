export const courseSearchableFields = ["title", "subtitle", "description", "category.title"];

export const courseFilterableFields = [
    "categoryId",
    "level",
    "language",
    "status",
    "courseType",
    "phase",
    "pricing",
    "delivery",
    "mode",
    "isFeatured",
    "isPopular",
    "price",
];

/**
 * Columns the catalogue's sort control is allowed to order by.
 *
 * Without this list `sort()` passes whatever `?sortBy=` holds straight to
 * Prisma, which rejects an unknown column and turns a typo in a query string
 * into a 500. Scalars only — sorting by a relation count needs `orderBy: { _count }`,
 * which this path can't express.
 */
export const courseSortableFields = [
    "createdAt",
    "publishedAt",
    "title",
    "price",
    "updatedAt",
];

/**
 * Public-facing mentor card shown on course listings and detail pages. The
 * bio lives on the learning profile (the account holds only identity); `toMentorCard` lifts it back to `bio` for the response.
 */
export const mentorCardSelect = {
    id: true,
    name: true,
    image: true,
    learningProfile: { select: { bio: true } },
    mentorProfile: {
        select: { designation: true, expertise: true, experience: true },
    },
} as const;

/**
 * How a course lists its mentors. `order` defaults to 0 and nothing sets it
 * yet, so it's usually a tie — then leads come first (the enum's order), then
 * whoever was assigned first. Without the tie-breakers Postgres may return
 * the same mentors in a different order from one request to the next.
 */
export const courseMentorOrder = [
    { order: "asc" as const },
    { role: "asc" as const },
    { createdAt: "asc" as const },
];

/** `{ learningProfile: { bio } , ... }` → `{ bio, ... }`, the shape clients read. */
export const toMentorCard = <M extends { learningProfile?: { bio: string | null } | null }>({ learningProfile, ...mentor }: M) => ({
    ...mentor,
    bio: learningProfile?.bio ?? null,
});
