import status from "http-status";
import { Prisma } from "../../../generated/prisma/client";
import {
    CourseDelivery,
    CourseLevel,
    CourseMentorRole,
    CourseMode,
    CoursePhase,
    CoursePricing,
    CourseStatus,
    CourseType,
    EnrollmentStatus,
    NotificationType,
    QuizAttemptStatus,
    SubmissionStatus,
} from "../../../generated/prisma/enums";
import { Role } from "../../lib/roles";
import {
    COURSE_IMAGE_FOLDER,
    deleteAuthenticatedFileFromCloudinary,
    deleteFileFromCloudinary,
    isCourseImageAsset,
    privateFileDownloadUrl,
    uploadFileToCloudinary,
    uploadPrivateFileToCloudinary,
} from "../../config/cloudinary.config";
import AppError from "../../errorHelpers/AppError";
import { IQueryParams } from "../../interfaces/query.interface";
import { IRequestUser } from "../../interfaces/requestUser.interface";
import { learnerScope } from "../../lib/learningProfile";
import { prisma } from "../../lib/prisma";
import { STUDENT_NAME_ONLY } from "../../lib/studentPrivacy";
import { assertCanManageCourse } from "../../utils/courseAccess";
import { assertBatchDates, BATCH_FIELDS, type BatchDates } from "../../utils/courseBatch";
import { clearItemModes, hasVenue, withBothModes } from "../../utils/courseMode";
import { logger } from "../../utils/logger";
import { QueryBuilder } from "../../utils/QueryBuilder";
import { generateCourseSlug } from "../../utils/slug";
import { PRACTICE_COURSE_FILTER } from "../../utils/weekItems";
import { formatDuration } from "../../utils/youtube";
import { createNotification } from "../notification/notification.service";
import { announceSupportClosed, cancelOpenSessions } from "../support/support.service";
import {
    courseFilterableFields,
    courseMentorOrder,
    courseSearchableFields,
    courseSortableFields,
    mentorCardSelect,
    toMentorCard,
} from "./course.constant";

type CreateCoursePayload = {
    title: string;
    description: string;
    price?: number;
    phase: CoursePhase;
    pricing: CoursePricing;
    delivery: CourseDelivery;
    [key: string]: unknown;
};

const courseCardBase = {
    category: { select: { id: true, title: true, slug: true, icon: true } },
    mentors: {
        orderBy: courseMentorOrder,
        select: { role: true, mentor: { select: mentorCardSelect } },
    },
} as const;

/**
 * Public course card. Counts are filtered to *published* curriculum only —
 * an unfiltered count would advertise "40 modules" on a course where only
 * three are actually live, which is the kind of number a buyer relies on.
 */
const publicCourseInclude = {
    ...courseCardBase,
    _count: {
        select: {
            enrollments: true,
            milestones: { where: { isPublished: true } },
            modules: { where: { isPublished: true } },
            videos: { where: { isPublished: true } },
        },
    },
} as const;

/** Admin course table — raw totals, including work in progress. */
const adminCourseInclude = {
    ...courseCardBase,
    _count: { select: { enrollments: true, milestones: true, modules: true, videos: true } },
} as const;

/**
 * Prisma returns every scalar column when a query uses `include` (as the
 * catalogue queries do, for the relation counts), so the roadmap PDF's
 * private Cloudinary URL would otherwise ride along in the public course
 * list/detail response. Strip it here rather than switching those queries to
 * an explicit `select` — the download route is the only place that ever
 * needs the real URL.
 */
const stripCurriculumPdfUrl = (course: Record<string, unknown>): Record<string, unknown> => {
    const {
        curriculumPdfUrl: _url,
        curriculumPdfPublicId: _publicId,
        curriculumPdfFileName: _fileName,
        curriculumPdfUpdatedAt: _updatedAt,
        ...rest
    } = course;
    return rest;
};

/**
 * The batch dates a save leaves the course with — the payload's where it sets
 * them, the stored ones where it doesn't — checked together, since each rule
 * spans two fields. A traditional course has no batches and is saved with
 * none, and neither is a previous one: its run is over, and with no window
 * left it takes enrolments as a recorded course, like a traditional one.
 */
const batchDatesFor = (
    courseType: CourseType,
    phase: CoursePhase,
    payload: Record<string, unknown>,
    stored?: BatchDates,
): BatchDates => {
    const dates = Object.fromEntries(
        BATCH_FIELDS.map((field) => {
            if (courseType !== CourseType.BOOTCAMP || phase === CoursePhase.PREVIOUS) return [field, null];
            const value = payload[field];
            if (value === undefined) return [field, stored?.[field] ?? null];
            return [field, value === null ? null : new Date(value as string)];
        }),
    ) as BatchDates;
    assertBatchDates(dates);
    return dates;
};

/**
 * The price a save leaves the course with. A free course costs ৳0 with no
 * discount, whatever the payload said; a paid one at least ৳1 even after its
 * discount, so the badge and the price can never disagree. Checked against
 * the merged record, as a PATCH may change only one of the fields — which is
 * also how a course moves between free and paid at any time, published or
 * not, leaving its phase, delivery and mode as they were.
 */
const priceFor = (
    pricing: CoursePricing | null,
    payload: Record<string, unknown>,
    stored?: { price: number; discountPrice: number | null },
) => {
    // Not decided yet (a seeded draft): nothing to check until it is.
    if (pricing === null) return {};
    if (pricing === CoursePricing.FREE) return { price: 0, discountPrice: null };

    const price = (payload.price as number | undefined) ?? stored?.price ?? 0;
    const discountPrice =
        payload.discountPrice === undefined ? (stored?.discountPrice ?? null) : (payload.discountPrice as number | null);
    if (price < 1) throw new AppError(status.BAD_REQUEST, "A paid course needs a price of at least ৳1.");
    if (discountPrice !== null && discountPrice >= price) {
        throw new AppError(status.BAD_REQUEST, "Discount price must be lower than the regular price.");
    }
    if (discountPrice === 0) {
        throw new AppError(status.BAD_REQUEST, "A paid course can't be discounted to ৳0. Mark it free instead.");
    }
    return { price, discountPrice };
};

/** Hiding a finished batch from discovery is bootcamp only; a traditional course is always listed. */
const TRADITIONAL_DISCOVERY = { hiddenFromHomepage: false, hiddenFromCatalogue: false } as const;

/**
 * The public list serves two places, each hiding its own courses:
 * `?placement=home` is the homepage, anything else the /courses page. The
 * related-courses rail and the category counts go with /courses.
 */
const listedOn = (placement: unknown) =>
    placement === "home" ? { hiddenFromHomepage: false } : { hiddenFromCatalogue: false };

/** Every image URL a course record points at. */
const imagesOf = (course: { thumbnail: string | null; gallery: string[] }) =>
    [course.thumbnail, ...course.gallery].filter((url): url is string => Boolean(url));

/**
 * Deletes the images a save dropped from a course — only ones the course
 * image upload stored, and only when no other course still shows them. Runs
 * after the save and never fails it: an image left behind costs storage, not
 * correctness.
 */
const deleteDroppedImages = (courseId: string, before: string[], after: string[]) => {
    const kept = new Set(after);
    const dropped = [...new Set(before)].filter((url) => !kept.has(url) && isCourseImageAsset(url));
    if (dropped.length === 0) return;

    void (async () => {
        for (const url of dropped) {
            const elsewhere = await prisma.course.count({
                where: {
                    id: { not: courseId },
                    OR: [{ thumbnail: url }, { gallery: { has: url } }],
                },
            });
            if (elsewhere === 0) await deleteFileFromCloudinary(url);
        }
    })().catch((error) => logger.error("Failed to clean up dropped course images", error));
};

const createCourse = async (user: IRequestUser, payload: CreateCoursePayload) => {
    logger.create("Creating course", { title: payload.title });

    if (payload.categoryId) {
        const category = await prisma.courseCategory.findUnique({
            where: { id: payload.categoryId as string },
            select: { id: true },
        });
        if (!category) throw new AppError(status.BAD_REQUEST, "That course category does not exist.");
    }

    const slug = await generateCourseSlug(payload.title);
    const courseType = (payload.courseType as CourseType | undefined) ?? CourseType.BOOTCAMP;
    const batches = batchDatesFor(courseType, payload.phase, payload);

    return prisma.course.create({
        data: {
            ...payload,
            ...priceFor(payload.pricing, payload),
            ...batches,
            ...(courseType !== CourseType.BOOTCAMP && TRADITIONAL_DISCOVERY),
            // A previous course has no support sessions, so its page says nothing about them.
            ...(payload.phase === CoursePhase.PREVIOUS && { supportInfo: null }),
            // Only a course with offline classes has a venue.
            ...(!hasVenue(payload.mode as CourseMode) && { venue: null }),
            slug,
            createdById: user.userId,
        },
        include: adminCourseInclude,
    });
};

/**
 * A course can move between phases at any time, with what each phase rules
 * out (see `utils/coursePhase.ts`) applied on the way:
 *
 *  - Into upcoming only while it has no modules and no outline — an upcoming
 *    course has neither, and leftovers nobody could edit would linger.
 *  - Into previous always. Its batch dates are cleared (the run is over), and
 *    every support session still to come is called off, students told once.
 *
 * Likewise a course that stops running both online and offline drops the
 * online/offline marks on its modules and outline items.
 */
const updateCourse = async (courseId: string, payload: Record<string, unknown>, actorId?: string) => {
    logger.update("Updating course", { courseId });

    const course = await prisma.course.findFirst({
        where: { id: courseId, isDeleted: false },
        select: {
            id: true, title: true, slug: true, price: true, discountPrice: true, status: true, publishedAt: true, courseType: true,
            phase: true, pricing: true, delivery: true, mode: true, description: true,
            thumbnail: true, gallery: true,
            enrollmentStartsAt: true, enrollmentEndsAt: true, startsAt: true, endsAt: true,
            nextEnrollmentStartsAt: true, nextEnrollmentEndsAt: true, nextStartsAt: true, nextEndsAt: true,
            _count: { select: { milestones: true, outlineWeeks: true } },
        },
    });
    if (!course) throw new AppError(status.NOT_FOUND, "Course not found.");

    const phase = (payload.phase as CoursePhase | undefined) ?? course.phase;
    const enteringUpcoming = phase === CoursePhase.UPCOMING && course.phase !== CoursePhase.UPCOMING;
    const enteringPrevious = phase === CoursePhase.PREVIOUS && course.phase !== CoursePhase.PREVIOUS;
    if (enteringUpcoming && (course._count.milestones > 0 || course._count.outlineWeeks > 0)) {
        throw new AppError(
            status.CONFLICT,
            "This course already has modules or an outline, and an upcoming course has neither. Remove them first, or keep the course present.",
        );
    }

    const courseType = (payload.courseType as CourseType | undefined) ?? course.courseType;
    const mode = (payload.mode as CourseMode | undefined) ?? course.mode;
    const data: Record<string, unknown> = {
        ...payload,
        ...priceFor((payload.pricing as CoursePricing | undefined) ?? course.pricing, payload, course),
        ...batchDatesFor(courseType, phase, payload, course),
        // Practice days are bootcamp only, so a traditional course says nothing about them.
        ...(courseType !== CourseType.BOOTCAMP && { practiceInfo: null, ...TRADITIONAL_DISCOVERY }),
        // Nor does a previous course about support sessions it no longer has.
        ...(phase === CoursePhase.PREVIOUS && { supportInfo: null }),
        // Only a course with offline classes has a venue.
        ...(!hasVenue(mode) && { venue: null }),
    };

    if (payload.status === CourseStatus.PUBLISHED) {
        assertClassified({
            pricing: (payload.pricing as CoursePricing | undefined) ?? course.pricing,
            delivery: (payload.delivery as CourseDelivery | undefined) ?? course.delivery,
            mode,
            description: (payload.description as string | undefined) ?? course.description,
        });
    }

    if (typeof payload.title === "string" && payload.title !== course.title) {
        data.slug = await generateCourseSlug(payload.title, courseId);
    }

    // Stamp the first publish so "newest courses" ordering is meaningful.
    if (payload.status === CourseStatus.PUBLISHED && !course.publishedAt) {
        data.publishedAt = new Date();
    }

    const leavingBootcamp =
        payload.courseType === CourseType.TRADITIONAL && course.courseType !== CourseType.TRADITIONAL;
    const leavingBoth = course.mode === CourseMode.BOTH && mode !== CourseMode.BOTH;

    const { updated, cancelledSessions } = await prisma.$transaction(async (tx) => {
        const next = await tx.course.update({
            where: { id: courseId },
            data,
            include: adminCourseInclude,
        });
        if (leavingBootcamp) await dropScheduling(tx, courseId);
        if (leavingBoth) await clearItemModes(tx, courseId);
        return { updated: next, cancelledSessions: enteringPrevious ? await cancelOpenSessions(tx, courseId) : [] };
    });

    deleteDroppedImages(courseId, imagesOf(course), imagesOf(updated));
    await announceSupportClosed(updated, cancelledSessions, actorId);
    return updated;
};

/**
 * A traditional course has no scheduling (see `assertCanSchedule`), so moving
 * one off bootcamp drops what only made sense there: pending module,
 * assignment and practice-day releases are cleared — they stay drafts, to
 * publish by hand — and the outline, listed and published by hand from now
 * on, starts from the order and published state its dates were giving it.
 */
const dropScheduling = async (tx: Prisma.TransactionClient, courseId: string) => {
    const pending = { courseId, isPublished: false, releaseAt: { not: null } };
    await tx.courseModule.updateMany({ where: pending, data: { releaseAt: null } });
    await tx.assignment.updateMany({ where: pending, data: { releaseAt: null } });
    await tx.practiceDay.updateMany({ where: pending, data: { releaseAt: null } });

    await tx.$executeRaw`
        UPDATE "learning"."outline_item" AS i
        SET "position" = ranked.rn,
            "isPublished" = (i."scheduledAt" IS NOT NULL AND i."scheduledAt" <= NOW())
        FROM (
            SELECT "id", ROW_NUMBER() OVER (
                PARTITION BY "weekId" ORDER BY "scheduledAt" ASC NULLS LAST, "createdAt" ASC
            ) AS rn
            FROM "learning"."outline_item"
            WHERE "courseId" = ${courseId}
        ) AS ranked
        WHERE i."id" = ranked."id"`;

    logger.update("Course left bootcamp — schedules cleared", { courseId });
};

/**
 * Scheduler job: once a bootcamp's present batch has ended, its next batch —
 * enrolment window and all — becomes the present one. One statement, so each
 * row moves atomically and a repeat finds nothing to move.
 */
const rollOverBatches = async () => {
    const moved = await prisma.$executeRaw`
        UPDATE "learning"."course"
        SET "enrollmentStartsAt" = "nextEnrollmentStartsAt", "enrollmentEndsAt" = "nextEnrollmentEndsAt",
            "startsAt" = "nextStartsAt", "endsAt" = "nextEndsAt",
            "nextEnrollmentStartsAt" = NULL, "nextEnrollmentEndsAt" = NULL,
            "nextStartsAt" = NULL, "nextEndsAt" = NULL
        WHERE "courseType" = 'BOOTCAMP' AND "isDeleted" = false
          AND "endsAt" <= NOW() AND "nextStartsAt" IS NOT NULL`;
    if (moved > 0) logger.update("Next batches moved up", { courses: moved });
};

/**
 * What a course needs decided before students can see it: free or paid, how
 * the classes are delivered, online or offline, and a description. A seeded
 * draft starts with none of them.
 */
const assertClassified = (course: {
    pricing: CoursePricing | null;
    delivery: CourseDelivery | null;
    mode: CourseMode | null;
    description: string;
}) => {
    const missing = [
        !course.pricing && "free or paid",
        !course.delivery && "how the classes are delivered",
        !course.mode && "online or offline",
        !course.description.trim() && "a description",
    ].filter(Boolean);
    if (missing.length > 0) {
        throw new AppError(status.BAD_REQUEST, `Set ${missing.join(", ")} in the course editor before publishing this course.`);
    }
};

const changeCourseStatus = async (courseId: string, nextStatus: CourseStatus) => {
    const course = await prisma.course.findFirst({
        where: { id: courseId, isDeleted: false },
        select: {
            id: true, publishedAt: true, curriculumPdfUrl: true, milestoneLabel: true, courseType: true, phase: true,
            pricing: true, delivery: true, mode: true, description: true,
            _count: { select: { milestones: true } },
        },
    });
    if (!course) throw new AppError(status.NOT_FOUND, "Course not found.");

    if (nextStatus === CourseStatus.PUBLISHED) {
        assertClassified(course);
        // Publishing an empty course would put a purchasable product with no
        // curriculum in front of students. Bootcamps are exempt: they sell on
        // the curriculum PDF and release milestones as the batch runs. So is
        // an upcoming course, which can't have milestones yet — it sells on
        // the PDF too.
        if (
            course.courseType !== CourseType.BOOTCAMP &&
            course.phase !== CoursePhase.UPCOMING &&
            course._count.milestones === 0
        ) {
            throw new AppError(
                status.BAD_REQUEST,
                `Add at least one ${course.milestoneLabel.toLowerCase()} before publishing this course.`,
            );
        }
        // The pre-enrolment roadmap PDF is mandatory — it's what a student
        // reads before they buy, and the create-course form already requires
        // it, so a course reaching this check without one is missing it.
        if (!course.curriculumPdfUrl) {
            throw new AppError(
                status.BAD_REQUEST,
                "Upload the curriculum PDF before publishing this course.",
            );
        }
    }

    return prisma.course.update({
        where: { id: courseId },
        data: {
            status: nextStatus,
            ...(nextStatus === CourseStatus.PUBLISHED && !course.publishedAt
                ? { publishedAt: new Date() }
                : {}),
        },
    });
};

const deleteCourse = async (courseId: string) => {
    logger.delete("Soft-deleting course", { courseId });

    const enrolled = await prisma.enrollment.count({
        where: { courseId, status: EnrollmentStatus.ACTIVE },
    });
    if (enrolled > 0) {
        throw new AppError(
            status.CONFLICT,
            `This course has ${enrolled} active student(s). Archive it instead of deleting so their access and progress are preserved.`,
        );
    }

    // Soft delete: purchase and certificate history must survive removal from
    // the catalogue. Mentor assignments aren't history worth keeping — a
    // deleted course has no "currently teaching" mentor, so those pivot rows
    // are hard-deleted here rather than left to rot (the schema's
    // `onDelete: Cascade` on CourseMentor only fires on a real row delete,
    // never on this soft-delete update).
    await prisma.$transaction([
        prisma.courseMentor.deleteMany({ where: { courseId } }),
        prisma.course.update({
            where: { id: courseId },
            data: { isDeleted: true, deletedAt: new Date(), status: CourseStatus.ARCHIVED },
        }),
    ]);
};

/** The enum columns the lists filter on, with the values each accepts. */
const ENUM_FILTERS: Record<string, readonly string[]> = {
    level: Object.values(CourseLevel),
    courseType: Object.values(CourseType),
    status: Object.values(CourseStatus),
    phase: Object.values(CoursePhase),
    pricing: Object.values(CoursePricing),
    delivery: Object.values(CourseDelivery),
    mode: Object.values(CourseMode),
};

/**
 * Drops an enum filter that names no member (`?phase=SOON`), so a stale or
 * mistyped link lists everything instead of reaching Prisma and failing as
 * a 500. A repeated key (`?phase=PRESENT&phase=UPCOMING`) stays if every
 * value is real.
 */
const withKnownEnums = (query: IQueryParams): IQueryParams => {
    const next = { ...query };
    for (const [key, members] of Object.entries(ENUM_FILTERS)) {
        const value = next[key];
        if (value === undefined) continue;
        const values = Array.isArray(value) ? value : [value];
        if (!values.every((entry) => typeof entry === "string" && members.includes(entry))) delete next[key];
    }
    return next;
};

/**
 * Public catalogue. Only published, non-deleted courses are ever returned —
 * the `where` clause is applied after the client's filters so a crafted
 * `?status=DRAFT` cannot surface unpublished work. Nor can a crafted
 * `?hiddenFromCatalogue=true`: the flag isn't filterable, and `listedOn`
 * pins it after the filters too.
 */
const getPublicCourses = async (query: IQueryParams) => {
    const builder = new QueryBuilder(prisma.course, withBothModes(withKnownEnums(query)), {
        searchableFields: courseSearchableFields,
        filterableFields: courseFilterableFields,
        sortableFields: courseSortableFields,
        maxLimit: 48,
    })
        .search()
        .filter()
        .sort();
    // `?sortBy=featured` — the catalogue's default: the courses an admin
    // featured (the main programmes) first, then the newest.
    if (query.sortBy === "featured") builder.orderBy([{ isFeatured: "desc" }, { createdAt: "desc" }]);

    const result = await builder
        .paginate()
        .include(publicCourseInclude)
        .where({ status: CourseStatus.PUBLISHED, isDeleted: false, ...listedOn(query.placement) })
        .execute();

    return { ...result, data: (result.data as Record<string, unknown>[]).map(stripCurriculumPdfUrl) };
};

const getAdminCourses = async (query: IQueryParams) => {
    return new QueryBuilder(prisma.course, withKnownEnums(query), {
        searchableFields: courseSearchableFields,
        filterableFields: courseFilterableFields,
        sortableFields: courseSortableFields,
        maxLimit: 100,
    })
        .search()
        .filter()
        .sort()
        .paginate()
        .include(adminCourseInclude)
        .where({ isDeleted: false })
        .execute();
};

/**
 * Course details page (plan §8). Anonymous visitors and enrolled students hit
 * the same endpoint; `user` is optional and only adds the `isEnrolled` flag.
 */
const getCourseBySlug = async (slug: string, user?: IRequestUser) => {
    const course = await prisma.course.findFirst({
        where: { slug, isDeleted: false, status: CourseStatus.PUBLISHED },
        include: {
            category: { select: { id: true, title: true, slug: true, icon: true } },
            mentors: {
                orderBy: courseMentorOrder,
                select: { role: true, mentor: { select: mentorCardSelect } },
            },
            milestones: {
                where: { isPublished: true },
                orderBy: { order: "asc" },
                select: {
                    id: true,
                    title: true,
                    description: true,
                    order: true,
                    modules: {
                        where: { isPublished: true },
                        orderBy: { order: "asc" },
                        select: {
                            id: true,
                            title: true,
                            order: true,
                            // Titles and durations are safe to preview; the
                            // YouTube link deliberately is not — that is what
                            // the student is paying for. The one exception is
                            // a lesson a mentor has marked as a free preview:
                            // its video id is released below, and only its.
                            videos: {
                                where: { isPublished: true },
                                orderBy: { order: "asc" },
                                select: {
                                    id: true,
                                    type: true,
                                    title: true,
                                    duration: true,
                                    order: true,
                                    isFreePreview: true,
                                    youtubeVideoId: true,
                                },
                            },
                        },
                    },
                    assignments: {
                        where: { isPublished: true },
                        orderBy: { order: "asc" },
                        select: { id: true, title: true, totalMarks: true, order: true },
                    },
                    practiceDays: {
                        where: { isPublished: true, ...PRACTICE_COURSE_FILTER },
                        orderBy: { order: "asc" },
                        select: { id: true, title: true, order: true },
                    },
                },
            },
            // Published-only, to match the curriculum tree above — the detail
            // page must never advertise more content than it lists.
            _count: {
                select: {
                    enrollments: true,
                    milestones: { where: { isPublished: true } },
                    modules: { where: { isPublished: true } },
                    videos: { where: { isPublished: true } },
                },
            },
        },
    });

    if (!course) throw new AppError(status.NOT_FOUND, "Course not found.");

    // Strip the video id from everything that isn't a free preview. Doing it
    // here, after the query, keeps the paywall in one obvious place rather
    // than relying on every future caller remembering the select.
    const milestones = course.milestones.map((milestone) => ({
        ...milestone,
        modules: milestone.modules.map((courseModule) => ({
            ...courseModule,
            videos: courseModule.videos.map((video) => {
                // Only a video can be previewed — the flag can't be set on
                // the other types, but the paywall shouldn't rely on that.
                const isFreePreview = video.isFreePreview && video.type === "VIDEO";
                return {
                    id: video.id,
                    type: video.type,
                    title: video.title,
                    duration: video.duration,
                    order: video.order,
                    isFreePreview,
                    youtubeVideoId: isFreePreview ? video.youtubeVideoId : null,
                };
            }),
        })),
    }));

    const totalSeconds = milestones
        .flatMap((m) => m.modules)
        .flatMap((m) => m.videos)
        .reduce((sum, v) => sum + v.duration, 0);

    const [isEnrolled, testimonials] = await Promise.all([
        user
            ? prisma.enrollment
                .findUnique({
                    where: { studentId_courseId: { studentId: user.userId, courseId: course.id } },
                    select: { id: true },
                })
                .then(Boolean)
            : Promise.resolve(false),
        // Quotes an admin tied to this course specifically — the homepage
        // strip mixes every course together, which is the wrong pitch here.
        prisma.testimonial.findMany({
            where: { courseId: course.id, isPublished: true },
            orderBy: [{ order: "asc" }, { createdAt: "desc" }],
            take: 6,
            select: {
                id: true,
                name: true,
                designation: true,
                avatar: true,
                videoUrl: true,
                quote: true,
                rating: true,
            },
        }),
    ]);

    return {
        ...stripCurriculumPdfUrl(course),
        mentors: course.mentors.map(({ mentor, ...assignment }) => ({ ...assignment, mentor: toMentorCard(mentor) })),
        milestones,
        totalDurationSeconds: totalSeconds,
        totalDuration: formatDuration(totalSeconds),
        totalAssignments: milestones.reduce((n, m) => n + m.assignments.length, 0),
        totalPracticeDays: milestones.reduce((n, m) => n + m.practiceDays.length, 0),
        // Published preview lessons, so the page can say "3 free lessons".
        freePreviewCount: milestones
            .flatMap((m) => m.modules)
            .flatMap((m) => m.videos)
            .filter((v) => v.isFreePreview).length,
        isEnrolled,
        testimonials,
    };
};

const getCourseById = async (courseId: string) => {
    const course = await prisma.course.findFirst({
        where: { id: courseId, isDeleted: false },
        include: {
            ...adminCourseInclude,
            milestones: {
                orderBy: { order: "asc" },
                include: {
                    modules: {
                        orderBy: { order: "asc" },
                        include: { _count: { select: { videos: true } } },
                    },
                    assignments: { orderBy: { order: "asc" } },
                    practiceDays: { orderBy: { order: "asc" } },
                },
            },
        },
    });

    if (!course) throw new AppError(status.NOT_FOUND, "Course not found.");
    return course;
};

/**
 * The header of the curriculum editor: title, slug and publish state, nothing
 * more.
 *
 * The editor is mounted in both consoles, so it can't read the course out of
 * either dashboard — an admin holds no mentor assignments and would have seen a
 * blank title, and `/manage/:courseId` is admin-only so a mentor can't call it.
 * `assertCanManageCourse` applies the same rule the curriculum writes do:
 * admins any course, mentors only theirs.
 */
const getStaffCourseSummary = async (user: IRequestUser, courseId: string) => {
    await assertCanManageCourse(user, courseId);

    const course = await prisma.course.findFirst({
        where: { id: courseId, isDeleted: false },
        select: {
            id: true,
            title: true,
            slug: true,
            status: true,
            courseType: true,
            phase: true,
            pricing: true,
            delivery: true,
            // A course that runs both has the editors mark each item online or offline.
            mode: true,
            thumbnail: true,
            milestoneLabel: true,
            moduleLabel: true,
            _count: { select: { enrollments: true, milestones: true, modules: true, videos: true } },
        },
    });

    if (!course) throw new AppError(status.NOT_FOUND, "Course not found.");
    return course;
};

/**
 * The full course record for whoever may manage it — the mentor's course
 * overview page reads this. Same shape as the admin editor's record, so the
 * two consoles render the same preview from the same data.
 */
const getStaffCourse = async (user: IRequestUser, courseId: string) => {
    await assertCanManageCourse(user, courseId);
    return getCourseById(courseId);
};

/**
 * A course's marks, for the staff who teach it: every assignment with its
 * hand-ins (status, score, when) and every quiz with each student's best
 * attempt. Students are named and nothing more (lib/studentPrivacy) — and
 * only those who handed something in or sat a quiz: who *hasn't* is a count,
 * since a list of them would be the course roster by another name.
 */
const getStaffCourseResults = async (user: IRequestUser, courseId: string) => {
    await assertCanManageCourse(user, courseId);

    const course = await prisma.course.findFirst({
        where: { id: courseId, isDeleted: false },
        select: { id: true, title: true, slug: true, courseType: true, milestoneLabel: true, moduleLabel: true },
    });
    if (!course) throw new AppError(status.NOT_FOUND, "Course not found.");

    const [learners, assignments, quizzes, bestAttempts] = await Promise.all([
        prisma.enrollment.count({
            where: { courseId, status: { in: [EnrollmentStatus.ACTIVE, EnrollmentStatus.COMPLETED] } },
        }),
        prisma.assignment.findMany({
            where: { courseId },
            orderBy: [{ milestone: { order: "asc" } }, { position: "asc" }, { order: "asc" }],
            select: {
                id: true, title: true, totalMarks: true, deadline: true, isPublished: true, releaseAt: true,
                milestone: { select: { order: true, title: true } },
                submissions: {
                    orderBy: { submittedAt: "asc" },
                    select: {
                        id: true, status: true, score: true, maxScore: true, submittedAt: true, reviewedAt: true,
                        student: { select: STUDENT_NAME_ONLY },
                    },
                },
            },
        }),
        prisma.quiz.findMany({
            where: { courseId },
            orderBy: [{ module: { milestone: { order: "asc" } } }, { module: { order: "asc" } }],
            select: {
                id: true, title: true, isPublished: true,
                module: { select: { id: true, title: true, order: true, milestone: { select: { order: true } } } },
                _count: { select: { questions: true } },
            },
        }),
        // Each student's best finished attempt per quiz, and how many they took.
        prisma.quizAttempt.groupBy({
            by: ["quizId", "studentId"],
            where: { quiz: { courseId }, status: QuizAttemptStatus.COMPLETED },
            _max: { percentage: true, completedAt: true },
            _count: { _all: true },
        }),
    ]);

    const takers = await prisma.user.findMany({
        where: { id: { in: [...new Set(bestAttempts.map((row) => row.studentId))] } },
        select: STUDENT_NAME_ONLY,
    });
    const nameOf = new Map(takers.map((student) => [student.id, student]));
    const average = (values: number[]) => (values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null);

    return {
        course,
        learners,
        assignments: assignments.map(({ submissions, ...assignment }) => {
            const scored = submissions.filter((row) => row.status === SubmissionStatus.ACCEPTED && row.score !== null);
            return {
                ...assignment,
                handedIn: submissions.length,
                counts: {
                    waiting: submissions.filter((row) => row.status === SubmissionStatus.SUBMITTED || row.status === SubmissionStatus.UNDER_REVIEW).length,
                    accepted: scored.length,
                    returned: submissions.filter((row) => row.status === SubmissionStatus.NEEDS_REVISION).length,
                    rejected: submissions.filter((row) => row.status === SubmissionStatus.REJECTED).length,
                },
                /** Of accepted work, as a percentage of the assignment's marks. */
                averagePercent: average(scored.map((row) => ((row.score as number) / Math.max(1, assignment.totalMarks)) * 100)),
                submissions,
            };
        }),
        quizzes: quizzes.map((quiz) => {
            const rows = bestAttempts
                .filter((row) => row.quizId === quiz.id && nameOf.has(row.studentId))
                .map((row) => ({
                    student: nameOf.get(row.studentId) as { id: string; name: string },
                    bestPercent: row._max.percentage ?? 0,
                    attempts: row._count._all,
                    lastAt: row._max.completedAt,
                }))
                .sort((a, b) => b.bestPercent - a.bestPercent || a.student.name.localeCompare(b.student.name));
            return {
                ...quiz,
                takers: rows.length,
                attempts: rows.reduce((sum, row) => sum + row.attempts, 0),
                averagePercent: average(rows.map((row) => row.bestPercent)),
                results: rows,
            };
        }),
    };
};

/**
 * Mentor edit of the *words* on a course page. Admins reach the same fields
 * through `updateCourse`; this path exists so a mentor can fix their own
 * course's description, outcomes, FAQ and feature tiles without being able to
 * touch the price, the category or the publish state.
 *
 * The route's Zod schema (`courseContentZodSchema`) is what limits the field
 * set — `payload` here is already narrowed to those keys.
 */
const updateCourseContent = async (
    user: IRequestUser,
    courseId: string,
    payload: Record<string, unknown>,
) => {
    await assertCanManageCourse(user, courseId);
    logger.update("Updating course content", { courseId, by: user.userId });

    const before = await prisma.course.findUniqueOrThrow({
        where: { id: courseId },
        select: { thumbnail: true, gallery: true, courseType: true, phase: true },
    });

    const updated = await prisma.course.update({
        where: { id: courseId },
        // Practice days are bootcamp only, support sessions not for a previous course — see `updateCourse`.
        data: {
            ...payload,
            ...(before.courseType !== CourseType.BOOTCAMP && { practiceInfo: null }),
            ...(before.phase === CoursePhase.PREVIOUS && { supportInfo: null }),
        },
        include: adminCourseInclude,
    });

    deleteDroppedImages(courseId, imagesOf(before), imagesOf(updated));
    return updated;
};

const MENTOR_ROLE_WORD: Record<CourseMentorRole, string> = {
    [CourseMentorRole.LEAD]: "lead mentor",
    [CourseMentorRole.CO_MENTOR]: "co-mentor",
    [CourseMentorRole.SUPPORT]: "support mentor",
};

const assignMentor = async (
    courseId: string,
    payload: { mentorId: string; role?: CourseMentorRole; order?: number },
    actorId?: string,
) => {
    const [course, mentor, before] = await Promise.all([
        prisma.course.findFirst({ where: { id: courseId, isDeleted: false }, select: { id: true, title: true } }),
        prisma.user.findFirst({
            where: { id: payload.mentorId, ...learnerScope(Role.MENTOR) },
            select: { id: true },
        }),
        prisma.courseMentor.findUnique({
            where: { courseId_mentorId: { courseId, mentorId: payload.mentorId } },
            select: { role: true },
        }),
    ]);

    if (!course) throw new AppError(status.NOT_FOUND, "Course not found.");
    if (!mentor) throw new AppError(status.NOT_FOUND, "Mentor not found.");

    // Idempotent: re-assigning an existing mentor updates their role/order
    // rather than failing on the unique constraint.
    const assignment = await prisma.courseMentor.upsert({
        where: { courseId_mentorId: { courseId, mentorId: payload.mentorId } },
        create: {
            courseId,
            mentorId: payload.mentorId,
            role: payload.role ?? CourseMentorRole.CO_MENTOR,
            order: payload.order ?? 0,
        },
        update: {
            ...(payload.role ? { role: payload.role } : {}),
            ...(payload.order !== undefined ? { order: payload.order } : {}),
        },
        include: { mentor: { select: mentorCardSelect } },
    });

    // Tell them — a new course, or a new role on one (a reorder alone isn't news).
    if (!before || before.role !== assignment.role) {
        await createNotification({
            userId: payload.mentorId,
            title: before ? `You're now ${MENTOR_ROLE_WORD[assignment.role]} on ${course.title}` : `You're teaching ${course.title}`,
            message: before
                ? `An admin changed your role on this course from ${MENTOR_ROLE_WORD[before.role]}.`
                : `An admin added you as ${MENTOR_ROLE_WORD[assignment.role]}. Its students, hand-ins and support sessions are on your dashboard now.`,
            type: NotificationType.COURSE,
            link: `/mentor/courses/${courseId}`,
            senderId: actorId,
        });
    }

    return assignment;
};

const removeMentor = async (courseId: string, mentorId: string, actorId?: string) => {
    const course = await prisma.course.findUnique({ where: { id: courseId }, select: { title: true } });
    const { count } = await prisma.courseMentor.deleteMany({ where: { courseId, mentorId } });
    if (count === 0) throw new AppError(status.NOT_FOUND, "That mentor is not assigned to this course.");

    await createNotification({
        userId: mentorId,
        title: `You're no longer on ${course?.title ?? "a course"}`,
        message: "An admin took you off this course. The reviews you gave and the sessions you ran stay on record.",
        type: NotificationType.COURSE,
        link: "/mentor/courses",
        senderId: actorId,
    });
};

/**
 * Swaps the pre-enrolment roadmap PDF and best-effort cleans up the previous
 * Cloudinary asset — same shape as `AuthService.updateAvatar`, but uploading
 * the buffer directly (`uploadPrivateFileToCloudinary`) rather than reading
 * an already-hosted URL off `req.file.path`: this asset is private, so there
 * is no public URL for `multerUpload`'s storage engine to hand back.
 */
const uploadCurriculumPdf = async (
    user: IRequestUser,
    courseId: string,
    buffer: Buffer,
    fileName: string,
) => {
    await assertCanManageCourse(user, courseId);

    const course = await prisma.course.findFirst({
        where: { id: courseId, isDeleted: false },
        select: { id: true, curriculumPdfPublicId: true },
    });
    if (!course) throw new AppError(status.NOT_FOUND, "Course not found.");

    logger.update("Uploading course curriculum PDF", { courseId });

    const uploaded = await uploadPrivateFileToCloudinary(buffer, fileName);

    const updated = await prisma.course.update({
        where: { id: courseId },
        data: {
            curriculumPdfUrl: uploaded.url,
            curriculumPdfPublicId: uploaded.publicId,
            curriculumPdfFileName: fileName,
            curriculumPdfUpdatedAt: new Date(),
        },
        select: { id: true, curriculumPdfUrl: true, curriculumPdfFileName: true, curriculumPdfUpdatedAt: true },
    });

    if (course.curriculumPdfPublicId) {
        deleteAuthenticatedFileFromCloudinary(course.curriculumPdfPublicId).catch((error) =>
            logger.error("Failed to clean up previous curriculum PDF", error),
        );
    }

    return updated;
};

/**
 * Stores one course image and answers with its URL. Nothing on the course
 * changes here: the image joins the course when the form holding the URL is
 * saved, and a save that drops it deletes it again (`deleteDroppedImages`).
 * The client crops to 16:9 before uploading.
 */
const uploadCourseImage = async (
    user: IRequestUser,
    courseId: string,
    buffer: Buffer,
    fileName: string,
    mimetype: string,
) => {
    await assertCanManageCourse(user, courseId);

    // The shared upload middleware also lets PDFs through.
    if (!mimetype.startsWith("image/")) {
        throw new AppError(status.BAD_REQUEST, "Upload a JPEG, PNG or WebP image.");
    }

    logger.create("Uploading course image", { courseId });
    const uploaded = await uploadFileToCloudinary(buffer, fileName, COURSE_IMAGE_FOLDER);
    return { url: uploaded.secure_url };
};

const removeCurriculumPdf = async (user: IRequestUser, courseId: string) => {
    await assertCanManageCourse(user, courseId);

    const course = await prisma.course.findFirst({
        where: { id: courseId, isDeleted: false },
        select: { id: true, curriculumPdfPublicId: true },
    });
    if (!course) throw new AppError(status.NOT_FOUND, "Course not found.");
    if (!course.curriculumPdfPublicId) return;

    logger.delete("Removing course curriculum PDF", { courseId });

    await prisma.course.update({
        where: { id: courseId },
        data: {
            curriculumPdfUrl: null,
            curriculumPdfPublicId: null,
            curriculumPdfFileName: null,
            curriculumPdfUpdatedAt: null,
        },
    });

    deleteAuthenticatedFileFromCloudinary(course.curriculumPdfPublicId).catch((error) =>
        logger.error("Failed to clean up removed curriculum PDF", error),
    );
};

/**
 * Fetches the roadmap PDF's bytes for the authenticated download route.
 *
 * The client never sees `curriculumPdfUrl` — every public course response
 * strips it (see `getPublicCourses`/`getCourseBySlug`) — so this is the only
 * path from "signed in" to "has the file". Proxying the bytes through our own
 * server, rather than redirecting to the Cloudinary URL, means that URL is
 * never exposed to the browser at all, not even in the Network tab.
 */
const downloadCurriculumPdf = async (slug: string) => {
    const course = await prisma.course.findFirst({
        where: { slug, isDeleted: false, status: CourseStatus.PUBLISHED },
        select: { title: true, curriculumPdfUrl: true, curriculumPdfFileName: true },
    });
    if (!course) throw new AppError(status.NOT_FOUND, "Course not found.");
    if (!course.curriculumPdfUrl) {
        throw new AppError(
            status.NOT_FOUND,
            "This course's curriculum is still being put together — check back soon.",
        );
    }

    const downloadUrl = privateFileDownloadUrl(course.curriculumPdfUrl);
    const response = downloadUrl ? await fetch(downloadUrl) : null;
    if (!response?.ok) {
        logger.error("Curriculum PDF fetch from Cloudinary failed", {
            slug,
            httpStatus: response?.status,
        });
        throw new AppError(status.BAD_GATEWAY, "Couldn't fetch the curriculum right now. Try again shortly.");
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    return { buffer, fileName: course.curriculumPdfFileName ?? `${course.title}-curriculum.pdf` };
};

export const CourseService = {
    getStaffCourseResults,
    createCourse,
    updateCourse,
    changeCourseStatus,
    deleteCourse,
    getPublicCourses,
    getAdminCourses,
    getCourseBySlug,
    getCourseById,
    getStaffCourseSummary,
    getStaffCourse,
    updateCourseContent,
    assignMentor,
    removeMentor,
    uploadCurriculumPdf,
    removeCurriculumPdf,
    downloadCurriculumPdf,
    uploadCourseImage,
    rollOverBatches,
};
