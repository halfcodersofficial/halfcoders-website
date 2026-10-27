import status from "http-status";
import { Prisma } from "../../../generated/prisma/client";
import { CourseReviewStatus, EnrollmentStatus, NotificationType } from "../../../generated/prisma/enums";
import AppError from "../../errorHelpers/AppError";
import { IQueryParams } from "../../interfaces/query.interface";
import { IRequestUser } from "../../interfaces/requestUser.interface";
import { prisma } from "../../lib/prisma";
import { STUDENT_NAME_ONLY } from "../../lib/studentPrivacy";
import { assertCanManageCourse } from "../../utils/courseAccess";
import { QueryBuilder } from "../../utils/QueryBuilder";
import { notifyAdmins } from "../notification/notification.service";

/** Average, count and the 5→1 spread, over the reviews given. */
const summarise = (rows: { rating: number }[]) => {
    const spread = [5, 4, 3, 2, 1].map((stars) => ({ stars, count: rows.filter((row) => row.rating === stars).length }));
    const count = rows.length;
    return {
        count,
        average: count ? Math.round((rows.reduce((sum, row) => sum + row.rating, 0) / count) * 10) / 10 : null,
        spread,
    };
};

const enrolmentFor = (studentId: string, courseId: string) =>
    prisma.enrollment.findUnique({ where: { studentId_courseId: { studentId, courseId } }, select: { status: true, progress: true } });

/** A student's own review of a course, and whether they may write one (they're on it). */
const getMine = async (user: IRequestUser, courseId: string) => {
    const [enrollment, review] = await Promise.all([
        enrolmentFor(user.userId, courseId),
        prisma.courseReview.findUnique({ where: { courseId_studentId: { courseId, studentId: user.userId } } }),
    ]);
    return { canReview: Boolean(enrollment && enrollment.status !== EnrollmentStatus.CANCELLED), review };
};

/**
 * Writes (or rewrites) a student's review. It reaches the course page only
 * once an admin publishes it — the page says only what staff chose to show —
 * so any change goes back for approval. Admins hear about new ones.
 */
const upsert = async (user: IRequestUser, courseId: string, payload: { rating: number; comment?: string }) => {
    const enrollment = await enrolmentFor(user.userId, courseId);
    if (!enrollment || enrollment.status === EnrollmentStatus.CANCELLED) {
        throw new AppError(status.FORBIDDEN, "Only students on the course can review it.");
    }
    const existing = await prisma.courseReview.findUnique({ where: { courseId_studentId: { courseId, studentId: user.userId } }, select: { id: true } });
    const data = { rating: payload.rating, comment: payload.comment || null, status: CourseReviewStatus.PENDING, moderatedById: null, moderatedAt: null };
    const review = await prisma.courseReview.upsert({
        where: { courseId_studentId: { courseId, studentId: user.userId } },
        create: { courseId, studentId: user.userId, ...data },
        update: data,
        include: { course: { select: { title: true } } },
    });
    if (!existing) {
        await notifyAdmins({
            title: `New review: ${review.course.title}`,
            message: `${"★".repeat(review.rating)}${"☆".repeat(5 - review.rating)}${review.comment ? ` — ${review.comment.slice(0, 160)}` : ""}`,
            type: NotificationType.COURSE,
            link: "/admin/reviews?status=PENDING",
            senderId: user.userId,
        });
    }
    return review;
};

const removeMine = async (user: IRequestUser, courseId: string) => {
    await prisma.courseReview.deleteMany({ where: { courseId, studentId: user.userId } });
};

/**
 * The course page's reviews: published ones only, newest first, with the
 * summary over them. Nothing published, nothing to show.
 */
const getPublic = async (slug: string) => {
    const course = await prisma.course.findFirst({ where: { slug, isDeleted: false }, select: { id: true } });
    if (!course) throw new AppError(status.NOT_FOUND, "Course not found.");
    const reviews = await prisma.courseReview.findMany({
        where: { courseId: course.id, status: CourseReviewStatus.PUBLISHED },
        orderBy: { createdAt: "desc" },
        select: { id: true, rating: true, comment: true, createdAt: true, student: { select: { id: true, name: true, image: true } } },
    });
    return { summary: summarise(reviews), reviews: reviews.slice(0, 30) };
};

/** For the course's staff: every review whatever its state, students by name only. */
const getForStaff = async (user: IRequestUser, courseId: string) => {
    await assertCanManageCourse(user, courseId);
    const reviews = await prisma.courseReview.findMany({
        where: { courseId },
        orderBy: { createdAt: "desc" },
        select: { id: true, rating: true, comment: true, status: true, createdAt: true, student: { select: STUDENT_NAME_ONLY } },
    });
    return { summary: summarise(reviews), published: reviews.filter((row) => row.status === CourseReviewStatus.PUBLISHED).length, reviews };
};

/** The admin's moderation list, by status and course. */
const getForAdmin = async (query: IQueryParams) =>
    new QueryBuilder(prisma.courseReview, query, {
        searchableFields: ["comment", "student.name", "course.title"],
        filterableFields: ["status", "courseId"],
        maxLimit: 100,
    })
        .search()
        .filter()
        .sort()
        .paginate()
        .include({
            student: { select: { id: true, name: true, email: true, image: true } },
            course: { select: { id: true, title: true, slug: true } },
            moderatedBy: { select: { id: true, name: true } },
        } satisfies Prisma.CourseReviewInclude)
        .execute();

/** How many reviews are in each state — the moderation tabs. */
const getCounts = async () => {
    const rows = await prisma.courseReview.groupBy({ by: ["status"], _count: { _all: true } });
    const counts: Record<CourseReviewStatus, number> = { PENDING: 0, PUBLISHED: 0, HIDDEN: 0 };
    for (const row of rows) counts[row.status] = row._count._all;
    return counts;
};

const moderate = async (user: IRequestUser, reviewId: string, next: CourseReviewStatus) => {
    const review = await prisma.courseReview.findUnique({ where: { id: reviewId }, select: { id: true } });
    if (!review) throw new AppError(status.NOT_FOUND, "Review not found.");
    return prisma.courseReview.update({
        where: { id: reviewId },
        data: { status: next, moderatedById: user.userId, moderatedAt: new Date() },
    });
};

export const CourseReviewService = { getMine, upsert, removeMine, getPublic, getForStaff, getForAdmin, getCounts, moderate };
