import { BundlePricing, CourseLevel, CoursePhase, CourseStatus } from "../../generated/prisma/enums";
import { prisma } from "../lib/prisma";
import { generateBundleSlug, generateCourseSlug } from "./slug";

/**
 * Half Coders' first courses and its first bundle, as the team named them
 * (2026-10-26): CodeBee running now as the main programme, seven coming, and
 * Career Launchpad. Only what was decided is here — the title and whether a
 * course is running or coming. Everything else (description, price, free or
 * paid, online or offline, live or recorded, schedule, modules) is left for an
 * admin to set in the course editor; each course is a draft, and can't be
 * published until it's set.
 */

export interface InitialCourse {
    /** How the bundle below refers to it. */
    key: string;
    title: string;
    phase: CoursePhase;
    /** A main programme — shown first in its section of the catalogue. */
    featured?: boolean;
    /** Only where the team wrote one. */
    description?: string;
    level?: CourseLevel;
}

export const INITIAL_COURSES: InitialCourse[] = [
    // ---- Running now: the main programme, first in the catalogue.
    { key: "codebee", title: "CodeBee — C, C++ & Data Structures and Algorithms", phase: CoursePhase.PRESENT, featured: true },

    // ---- Coming next.
    { key: "interviewedge", title: "InterviewEdge — Interview Preparation & Career Success", phase: CoursePhase.UPCOMING },
    { key: "inboxpro", title: "InboxPro — Professional Email & Business Communication", phase: CoursePhase.UPCOMING },
    { key: "linkedin-elevate", title: "LinkedIn Elevate — Professional Branding & Profile Optimization", phase: CoursePhase.UPCOMING },
    { key: "resumecraft", title: "ResumeCraft — ATS-Friendly Resume & CV Mastery", phase: CoursePhase.UPCOMING },
    { key: "portfoliai", title: "PortfoliAI — AI-Powered Digital Portfolio Creation", phase: CoursePhase.UPCOMING },
    { key: "commerceforge", title: "CommerceForge AI — Industry-Grade E-commerce Development", phase: CoursePhase.UPCOMING },
    {
        key: "codemath",
        title: "CodeMath Foundation — Essential Math Before Programming",
        phase: CoursePhase.UPCOMING,
        description:
            "CodeMath Foundation is a beginner-friendly preparatory course designed to help students build the mathematical and logical foundations needed before starting a programming course.",
        level: CourseLevel.BEGINNER,
    },
];

/** Career Launchpad: switched off and unpriced until an admin sets its price. */
export const INITIAL_BUNDLE = {
    title: "Career Launchpad",
    courseKeys: ["inboxpro", "linkedin-elevate", "resumecraft", "portfoliai", "commerceforge"],
};

export interface SeedReport {
    created: string[];
    /** Already there (matched by title) — left exactly as it is. */
    kept: string[];
    bundle: "created" | "kept";
}

/**
 * Adds whichever of these courses and the bundle aren't there yet, matched by
 * title (any case, deleted ones included — an admin's deletion stands). What
 * is there is never touched, so it's safe to run again.
 *
 * The catalogue lists newest first, so the courses are stamped a second apart
 * in reverse: within each section they come out in the order above.
 */
export const seedInitialCatalogue = async (): Promise<SeedReport> => {
    const report: SeedReport = { created: [], kept: [], bundle: "kept" };
    const idOf = new Map<string, string>();
    const startedAt = Date.now();

    for (const [index, seed] of INITIAL_COURSES.entries()) {
        const existing = await prisma.course.findFirst({
            where: { title: { equals: seed.title, mode: "insensitive" } },
            select: { id: true },
        });
        if (existing) {
            idOf.set(seed.key, existing.id);
            report.kept.push(seed.title);
            continue;
        }

        const course = await prisma.course.create({
            data: {
                title: seed.title,
                slug: await generateCourseSlug(seed.title),
                description: seed.description ?? "",
                phase: seed.phase,
                status: CourseStatus.DRAFT,
                // Not decided yet — the admin chooses each in the course editor.
                pricing: null,
                delivery: null,
                mode: null,
                isFeatured: seed.featured ?? false,
                ...(seed.level && { level: seed.level }),
                createdAt: new Date(startedAt - index * 1000),
            },
            select: { id: true },
        });
        idOf.set(seed.key, course.id);
        report.created.push(seed.title);
    }

    const bundle = await prisma.courseBundle.findFirst({
        where: { title: { equals: INITIAL_BUNDLE.title, mode: "insensitive" } },
        select: { id: true },
    });
    if (!bundle) {
        await prisma.courseBundle.create({
            data: {
                title: INITIAL_BUNDLE.title,
                slug: await generateBundleSlug(INITIAL_BUNDLE.title),
                // Unpriced and off: it can't be switched on until a price or a discount is set.
                pricing: BundlePricing.PERCENT,
                discountPercent: null,
                isActive: false,
                items: {
                    create: INITIAL_BUNDLE.courseKeys.map((key, order) => ({ courseId: idOf.get(key)!, order })),
                },
            },
        });
        report.bundle = "created";
    }

    return report;
};
