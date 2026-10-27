import z from "zod";
import {
    CourseDelivery,
    CourseLevel,
    CourseMentorRole,
    CourseMode,
    CoursePhase,
    CoursePricing,
    CourseStatus,
    CourseType,
} from "../../../generated/prisma/enums";
import { COURSE_TECH_STACK_ICONS } from "./techStackIcons";

/** Per-course curriculum terminology, e.g. "Week" instead of "Milestone". */
const outlineLabel = z.string().trim().min(1).max(40);

/**
 * Goes into the course's certificate IDs ("CE" in HCC-CE-2026-000125). Starts
 * with a letter so it can't be mistaken for the year — see `nextCertificateNumber`.
 */
const certificateCode = z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z][A-Z0-9]{0,7}$/, "Use up to 8 capital letters and digits, starting with a letter");

/**
 * The icon set the course page can draw. A closed list rather than a free
 * string because the client maps each key to a bundled icon component — an
 * unknown key would render nothing, and a URL here would be a place to inject
 * markup into the public page.
 */
export const COURSE_FEATURE_ICONS = [
    "video",
    "live",
    "file",
    "quiz",
    "assignment",
    "practice",
    "support",
    "community",
    "certificate",
    "book",
    "calendar",
    "code",
    "chat",
    "target",
    "clock",
    "infinity",
    "check",
    "mobile",
    "layers",
] as const;

const featureSchema = z.object({
    icon: z.enum(COURSE_FEATURE_ICONS).default("video"),
    title: z.string().trim().min(2, "A feature needs a title").max(80),
    description: z.string().trim().max(200).optional(),
});

/** One icon-and-text line — the hero facts. */
const iconLine = (maxLength: number) =>
    z.object({
        icon: z.enum(COURSE_FEATURE_ICONS).default("check"),
        text: z.string().trim().min(1, "A line needs some text").max(maxLength),
    });

const faqSchema = z.object({
    question: z.string().trim().min(5, "A question needs at least 5 characters").max(200),
    answer: z.string().trim().min(5, "An answer needs at least 5 characters").max(2000),
});

/** The tech-stack icon keys — tools and subjects for every kind of course. */
export { COURSE_TECH_STACK_ICONS };

const techStackItemSchema = z.object({
    icon: z.enum(COURSE_TECH_STACK_ICONS).default("javascript"),
    name: z.string().trim().min(1, "A tech stack item needs a name").max(40),
});

const features = z.array(featureSchema).max(12, "At most 12 features");
const faqs = z.array(faqSchema).max(20, "At most 20 questions");
const heroFacts = z.array(iconLine(60)).max(6, "At most 6 hero facts");
const outcomes = z.array(z.string().trim().min(1).max(300)).max(30);
const techStack = z.array(techStackItemSchema).max(20, "At most 20 tech stack items");

/** Images after the thumbnail — six in all. Uploaded through `/staff/:courseId/images`. */
const MAX_GALLERY_IMAGES = 5;
const gallery = z.array(z.string().url()).max(MAX_GALLERY_IMAGES, `At most ${MAX_GALLERY_IMAGES} images besides the thumbnail`);

/**
 * The fields a mentor may edit on a course they teach — the words on the
 * page, not the commercial or catalogue settings. Price, discount, category,
 * level, status and the featured flags stay admin-only, and the title is too,
 * because renaming regenerates the public URL.
 */
export const courseContentZodSchema = z.object({
    subtitle: z.string().trim().max(255).nullable().optional(),
    description: z.string().trim().min(20, "Description must be at least 20 characters").optional(),
    overview: z.string().trim().nullable().optional(),
    thumbnail: z.string().url().nullable().optional(),
    gallery: gallery.optional(),
    promoVideoUrl: z.string().url().nullable().optional(),
    outcomes: outcomes.optional(),
    requirements: outcomes.optional(),
    features: features.optional(),
    techStack: techStack.optional(),
    faqs: faqs.optional(),
    heroFacts: heroFacts.optional(),
    assignmentInfo: z.string().trim().max(2000).nullable().optional(),
    practiceInfo: z.string().trim().max(2000).nullable().optional(),
    supportInfo: z.string().trim().max(2000).nullable().optional(),
    milestoneLabel: outlineLabel.optional(),
    moduleLabel: outlineLabel.optional(),
});

export const createCourseZodSchema = z.object({
    title: z.string().trim().min(3, "Title must be at least 3 characters").max(160),
    subtitle: z.string().trim().max(255).optional(),
    description: z.string().trim().min(20, "Description must be at least 20 characters"),
    overview: z.string().trim().optional(),
    thumbnail: z.string().url().optional(),
    gallery: gallery.optional(),
    promoVideoUrl: z.string().url().optional(),
    /** Required for a paid course; a free one is stored at ৳0 whatever this says. */
    price: z.number().int("Price must be a whole number of Taka").min(0).max(10_000_000).optional(),
    discountPrice: z.number().int().min(0).max(10_000_000).optional(),
    duration: z.string().trim().max(60).optional(),
    certificateCode: certificateCode.optional(),
    level: z.enum(CourseLevel).optional(),
    language: z.string().trim().max(40).optional(),
    /** Which learning experience this course uses — defaults to the
     *  platform's original behaviour when omitted. See `CourseType`. */
    courseType: z.enum(CourseType).optional(),
    /** The three classifications the admin must choose up front. */
    phase: z.enum(CoursePhase, "Choose the course status: present, upcoming or previous"),
    pricing: z.enum(CoursePricing, "Choose whether the course is free or paid"),
    delivery: z.enum(CourseDelivery, "Choose how the classes are delivered"),
    mode: z.enum(CourseMode, "Choose online, offline or both"),
    venue: z.string().trim().max(200).optional(),
    outcomes: outcomes.optional(),
    requirements: outcomes.optional(),
    features: features.optional(),
    techStack: techStack.optional(),
    faqs: faqs.optional(),
    heroFacts: heroFacts.optional(),
    /** Bootcamp batches — see `utils/courseBatch.ts`. */
    enrollmentStartsAt: z.iso.datetime({ offset: true }).optional(),
    enrollmentEndsAt: z.iso.datetime({ offset: true }).optional(),
    startsAt: z.iso.datetime({ offset: true }).optional(),
    endsAt: z.iso.datetime({ offset: true }).optional(),
    nextEnrollmentStartsAt: z.iso.datetime({ offset: true }).optional(),
    nextEnrollmentEndsAt: z.iso.datetime({ offset: true }).optional(),
    nextStartsAt: z.iso.datetime({ offset: true }).optional(),
    nextEndsAt: z.iso.datetime({ offset: true }).optional(),
    assignmentInfo: z.string().trim().max(2000).optional(),
    practiceInfo: z.string().trim().max(2000).optional(),
    supportInfo: z.string().trim().max(2000).optional(),
    milestoneLabel: outlineLabel.optional(),
    moduleLabel: outlineLabel.optional(),
    categoryId: z.string().trim().min(1).optional(),
    isFeatured: z.boolean().optional(),
    isPopular: z.boolean().optional(),
    /** Bootcamp only — the service stores false on a traditional course. */
    hiddenFromHomepage: z.boolean().optional(),
    hiddenFromCatalogue: z.boolean().optional(),
})
    .refine(
        (data) => data.pricing === CoursePricing.FREE || (data.price ?? 0) >= 1,
        { path: ["price"], message: "A paid course needs a price of at least ৳1" },
    )
    // A discount that isn't below the price would render as a nonsensical
    // "৳5000 ~~৳5000~~" on the course card.
    .refine(
        (data) => data.pricing === CoursePricing.FREE || data.discountPrice === undefined || data.discountPrice < (data.price ?? 0),
        { path: ["discountPrice"], message: "Discount price must be lower than the regular price" },
    )
    .refine(
        (data) => data.pricing === CoursePricing.FREE || data.discountPrice === undefined || data.discountPrice >= 1,
        { path: ["discountPrice"], message: "A paid course can't be discounted to ৳0 — mark it free instead" },
    );

/**
 * Every column that is nullable in the schema accepts `null` here, not just
 * `undefined`. The two mean different things on a PATCH: omitting a field
 * leaves it alone, while `null` clears it. Without that distinction an admin
 * could set a thumbnail or a subtitle but never remove one — the field would
 * be stuck at whatever it was first given.
 */
export const updateCourseZodSchema = z.object({
    title: z.string().trim().min(3).max(160).optional(),
    subtitle: z.string().trim().max(255).nullable().optional(),
    description: z.string().trim().min(20).optional(),
    overview: z.string().trim().nullable().optional(),
    thumbnail: z.string().url().nullable().optional(),
    gallery: gallery.optional(),
    promoVideoUrl: z.string().url().nullable().optional(),
    price: z.number().int().min(0).max(10_000_000).optional(),
    discountPrice: z.number().int().min(0).max(10_000_000).nullable().optional(),
    duration: z.string().trim().max(60).nullable().optional(),
    certificateCode: certificateCode.nullable().optional(),
    level: z.enum(CourseLevel).optional(),
    language: z.string().trim().max(40).optional(),
    status: z.enum(CourseStatus).optional(),
    courseType: z.enum(CourseType).optional(),
    /** Each change of phase has knock-on effects — see `CourseService.updateCourse`. */
    phase: z.enum(CoursePhase).optional(),
    pricing: z.enum(CoursePricing).optional(),
    delivery: z.enum(CourseDelivery).optional(),
    mode: z.enum(CourseMode).optional(),
    venue: z.string().trim().max(200).nullable().optional(),
    outcomes: outcomes.optional(),
    requirements: outcomes.optional(),
    features: features.optional(),
    techStack: techStack.optional(),
    faqs: faqs.optional(),
    heroFacts: heroFacts.optional(),
    enrollmentStartsAt: z.iso.datetime({ offset: true }).nullable().optional(),
    enrollmentEndsAt: z.iso.datetime({ offset: true }).nullable().optional(),
    startsAt: z.iso.datetime({ offset: true }).nullable().optional(),
    endsAt: z.iso.datetime({ offset: true }).nullable().optional(),
    nextEnrollmentStartsAt: z.iso.datetime({ offset: true }).nullable().optional(),
    nextEnrollmentEndsAt: z.iso.datetime({ offset: true }).nullable().optional(),
    nextStartsAt: z.iso.datetime({ offset: true }).nullable().optional(),
    nextEndsAt: z.iso.datetime({ offset: true }).nullable().optional(),
    assignmentInfo: z.string().trim().max(2000).nullable().optional(),
    practiceInfo: z.string().trim().max(2000).nullable().optional(),
    supportInfo: z.string().trim().max(2000).nullable().optional(),
    milestoneLabel: outlineLabel.optional(),
    moduleLabel: outlineLabel.optional(),
    categoryId: z.string().trim().min(1).nullable().optional(),
    isFeatured: z.boolean().optional(),
    isPopular: z.boolean().optional(),
    /** Bootcamp only — the service stores false on a traditional course. */
    hiddenFromHomepage: z.boolean().optional(),
    hiddenFromCatalogue: z.boolean().optional(),
});

export const changeCourseStatusZodSchema = z.object({
    status: z.enum(CourseStatus),
});

export const assignMentorZodSchema = z.object({
    mentorId: z.string().trim().min(1, "Mentor is required"),
    role: z.enum(CourseMentorRole).optional(),
    order: z.number().int().min(0).max(100).optional(),
});

export const createCategoryZodSchema = z.object({
    title: z.string().trim().min(2).max(80),
    icon: z.string().trim().max(255).optional(),
    description: z.string().trim().max(500).optional(),
    order: z.number().int().min(0).max(1000).optional(),
});

export const updateCategoryZodSchema = createCategoryZodSchema.partial().extend({
    isActive: z.boolean().optional(),
});
