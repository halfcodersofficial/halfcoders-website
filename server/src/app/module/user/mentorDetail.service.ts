import status from "http-status";
import { EnrollmentStatus, SubmissionStatus, SupportQueueStatus, SupportSessionStatus } from "../../../generated/prisma/enums";
import AppError from "../../errorHelpers/AppError";
import { IRequestUser } from "../../interfaces/requestUser.interface";
import { learnerScope } from "../../lib/learningProfile";
import { prisma } from "../../lib/prisma";
import { Role } from "../../lib/roles";
import { describeUserAgent } from "../../lib/userAgent";
import { UserService } from "./user.service";

/**
 * Everything about one mentor, for the admin's mentor detail page: their
 * courses and how those courses' students are doing, their support sessions
 * and reviews, the change history (`StaffActivity`) and where they are signed
 * in. Reviews and support sessions go back to the start; the change history
 * only as far as its table does.
 */

const TREND_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;
const RECENT_LIMIT = 20;
/** Reviews returned within this many hours count as prompt. */
const PROMPT_REVIEW_HOURS = 48;

/** A day as students and mentors in Bangladesh see it. */
const dhakaDay = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" });
const dayKey = (date: Date) => dhakaDay.format(date);

/** Change-history entries that are content work, as opposed to reviews and support. */
const CONTENT_ENTITIES = [
    "course", "week", "module", "lesson", "quiz", "question", "assignment", "material", "practice",
    "outlineWeek", "outlineItem", "conceptualTopic", "conceptualSession",
];

const assertMentor = async (mentorId: string) => {
    const mentor = await prisma.user.findFirst({
        where: { id: mentorId, ...learnerScope(Role.MENTOR) },
        select: { id: true },
    });
    if (!mentor) throw new AppError(status.NOT_FOUND, "Mentor not found.");
};

const getMentorOverview = async (mentorId: string) => {
    const mentor = await UserService.getMentorById(mentorId);
    const courseIds = mentor.mentoredCourses.map(({ course }) => course.id);
    const inTheirCourses = { courseId: { in: courseIds } };

    // The trend's days, oldest first, ending today in Dhaka. Rows are fetched
    // from a full extra day back so the first day is never cut short; anything
    // outside these days is simply not counted.
    const now = new Date();
    const days = Array.from({ length: TREND_DAYS }, (_, index) =>
        dayKey(new Date(now.getTime() - (TREND_DAYS - 1 - index) * DAY_MS)),
    );
    const since = new Date(now.getTime() - TREND_DAYS * DAY_MS);

    const [
        enrollmentGroups,
        completedGroups,
        students,
        certificates,
        sessionGroups,
        upcomingSessions,
        studentsHelped,
        reviewTimes,
        pendingReviews,
        quizzesAuthored,
        activityGroups,
        bulkLessonRows,
        recentChanges,
        recentSessionDates,
        recentSupportSessions,
        lastChange,
    ] = await Promise.all([
        prisma.enrollment.groupBy({
            by: ["courseId"],
            where: { ...inTheirCourses, status: { not: EnrollmentStatus.CANCELLED } },
            _count: { _all: true },
            _avg: { progress: true },
        }),
        prisma.enrollment.groupBy({
            by: ["courseId"],
            where: { ...inTheirCourses, status: EnrollmentStatus.COMPLETED },
            _count: { _all: true },
        }),
        prisma.enrollment.groupBy({
            by: ["studentId"],
            where: { ...inTheirCourses, status: { not: EnrollmentStatus.CANCELLED } },
        }),
        prisma.certificate.count({ where: inTheirCourses }),
        prisma.supportSession.groupBy({ by: ["status"], where: { mentorId }, _count: { _all: true } }),
        prisma.supportSession.count({
            where: { mentorId, status: SupportSessionStatus.SCHEDULED, startTime: { gt: new Date() } },
        }),
        prisma.supportQueue.count({ where: { session: { mentorId }, status: SupportQueueStatus.COMPLETED } }),
        prisma.assignmentSubmission.findMany({
            where: { reviewedById: mentorId, reviewedAt: { not: null } },
            select: { submittedAt: true, reviewedAt: true },
        }),
        prisma.assignmentSubmission.count({
            where: {
                assignment: inTheirCourses,
                status: { in: [SubmissionStatus.SUBMITTED, SubmissionStatus.UNDER_REVIEW] },
            },
        }),
        prisma.quiz.count({ where: { createdById: mentorId } }),
        prisma.staffActivity.groupBy({ by: ["action"], where: { actorId: mentorId }, _count: { _all: true } }),
        prisma.staffActivity.findMany({
            where: { actorId: mentorId, action: "lesson.bulkCreate" },
            select: { detail: true },
        }),
        prisma.staffActivity.findMany({
            where: { actorId: mentorId, createdAt: { gte: since }, entityType: { in: CONTENT_ENTITIES } },
            select: { createdAt: true },
        }),
        prisma.supportSession.findMany({
            where: { mentorId, startTime: { gte: since, lte: new Date() }, status: { not: SupportSessionStatus.CANCELLED } },
            select: { startTime: true },
        }),
        prisma.supportSession.findMany({
            where: { mentorId },
            orderBy: { startTime: "desc" },
            take: RECENT_LIMIT,
            select: {
                id: true, title: true, status: true, startTime: true, endTime: true,
                course: { select: { id: true, title: true } },
                _count: { select: { queue: true } },
                queue: { where: { status: SupportQueueStatus.COMPLETED }, select: { id: true } },
            },
        }),
        prisma.staffActivity.findFirst({
            where: { actorId: mentorId },
            orderBy: { createdAt: "desc" },
            select: { createdAt: true },
        }),
    ]);

    // ---- Courses, with how their students are doing
    const enrolled = new Map(enrollmentGroups.map((group) => [group.courseId, group]));
    const completed = new Map(completedGroups.map((group) => [group.courseId, group._count._all]));
    const courses = mentor.mentoredCourses.map(({ role, course }) => {
        const group = enrolled.get(course.id);
        return {
            ...course,
            role,
            students: group?._count._all ?? 0,
            completed: completed.get(course.id) ?? 0,
            averageProgress: Math.round(group?._avg.progress ?? 0),
        };
    });

    // ---- Reviews: how many, and how quickly
    const turnaroundHours = reviewTimes.map(
        ({ submittedAt, reviewedAt }) => ((reviewedAt as Date).getTime() - submittedAt.getTime()) / 3_600_000,
    );
    const averageTurnaroundHours = turnaroundHours.length
        ? Math.round((turnaroundHours.reduce((sum, hours) => sum + Math.max(0, hours), 0) / turnaroundHours.length) * 10) / 10
        : null;
    const promptShare = turnaroundHours.length
        ? Math.round((turnaroundHours.filter((hours) => hours <= PROMPT_REVIEW_HOURS).length / turnaroundHours.length) * 100)
        : null;

    // ---- Support
    const sessionsBy = Object.fromEntries(sessionGroups.map((group) => [group.status, group._count._all]));
    const totalSessions = sessionGroups.reduce((sum, group) => sum + group._count._all, 0);

    // ---- Content work, from the change history
    const actions = Object.fromEntries(activityGroups.map((group) => [group.action, group._count._all]));
    const bulkLessons = bulkLessonRows.reduce((sum, row) => {
        const count = (row.detail as { count?: unknown } | null)?.count;
        return sum + (typeof count === "number" ? count : 0);
    }, 0);

    // ---- The last 30 days, day by day
    const tally = (dates: Date[]) => {
        const counts = new Map<string, number>();
        for (const date of dates) counts.set(dayKey(date), (counts.get(dayKey(date)) ?? 0) + 1);
        return counts;
    };
    const changesByDay = tally(recentChanges.map((row) => row.createdAt));
    const reviewsByDay = tally(
        reviewTimes.map((row) => row.reviewedAt as Date).filter((date) => date >= since),
    );
    const sessionsByDay = tally(recentSessionDates.map((row) => row.startTime));
    const trend = days.map((day) => ({
        date: day,
        changes: changesByDay.get(day) ?? 0,
        reviews: reviewsByDay.get(day) ?? 0,
        supportSessions: sessionsByDay.get(day) ?? 0,
    }));

    const lastReviewedAt = reviewTimes.reduce<Date | null>(
        (latest, { reviewedAt }) => (reviewedAt && (!latest || reviewedAt > latest) ? reviewedAt : latest),
        null,
    );
    const lastActivityAt = [lastChange?.createdAt, lastReviewedAt]
        .filter((date): date is Date => Boolean(date))
        .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;

    return {
        mentor,
        courses,
        stats: {
            courses: courses.length,
            students: students.length,
            certificates,
            support: {
                total: totalSessions,
                ended: sessionsBy[SupportSessionStatus.ENDED] ?? 0,
                live: sessionsBy[SupportSessionStatus.LIVE] ?? 0,
                cancelled: sessionsBy[SupportSessionStatus.CANCELLED] ?? 0,
                upcoming: upcomingSessions,
                studentsHelped,
            },
            reviews: {
                total: reviewTimes.length,
                pending: pendingReviews,
                averageTurnaroundHours,
                promptShare,
                promptHours: PROMPT_REVIEW_HOURS,
            },
            content: {
                changes: activityGroups.reduce((sum, group) => sum + group._count._all, 0),
                lessonsAdded: (actions["lesson.create"] ?? 0) + bulkLessons,
                modulesAdded: actions["module.create"] ?? 0,
                quizzesAdded: actions["quiz.create"] ?? 0,
                assignmentsAdded: actions["assignment.create"] ?? 0,
                /** From each quiz's author column, which predates the change history. */
                quizzesAuthored,
            },
            lastActivityAt,
        },
        trend,
        recentSupportSessions: recentSupportSessions.map(({ queue, _count, ...session }) => ({
            ...session,
            studentsJoined: _count.queue,
            studentsHelped: queue.length,
        })),
    };
};

const getMentorActivity = async (
    mentorId: string,
    query: { page?: unknown; limit?: unknown; courseId?: unknown },
) => {
    await assertMentor(mentorId);

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 30));
    const where = {
        actorId: mentorId,
        ...(typeof query.courseId === "string" && query.courseId ? { courseId: query.courseId } : {}),
    };

    const [data, total] = await Promise.all([
        prisma.staffActivity.findMany({
            where,
            orderBy: { createdAt: "desc" },
            skip: (page - 1) * limit,
            take: limit,
            select: {
                id: true, action: true, summary: true, entityType: true, entityId: true, detail: true,
                ipAddress: true, userAgent: true, createdAt: true,
                course: { select: { id: true, title: true } },
            },
        }),
        prisma.staffActivity.count({ where }),
    ]);

    return {
        data: data.map(({ userAgent, ...entry }) => ({ ...entry, device: describeUserAgent(userAgent) })),
        meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    };
};

const REVIEW_RESULTS: string[] = [
    SubmissionStatus.ACCEPTED,
    SubmissionStatus.NEEDS_REVISION,
    SubmissionStatus.REJECTED,
    SubmissionStatus.UNDER_REVIEW,
];

/** A score as a percentage of what the submission could earn (a late one's cap, else full marks). */
const percentOf = (score: number, maxScore: number | null, totalMarks: number) => {
    const outOf = maxScore ?? totalMarks;
    return outOf > 0 ? (score / outOf) * 100 : null;
};

/**
 * Every submission the mentor has marked: the student, the assignment and its
 * course, the marks and when they were given — filterable by course, result
 * and student — plus a per-course summary. Each submission keeps only its
 * latest review; the earlier ones this mentor made come from the change
 * history, as `history`.
 */
const getMentorReviews = async (
    mentorId: string,
    query: { page?: unknown; limit?: unknown; courseId?: unknown; status?: unknown; search?: unknown },
) => {
    await assertMentor(mentorId);

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 25));
    const courseId = typeof query.courseId === "string" && query.courseId ? query.courseId : undefined;
    const status = typeof query.status === "string" && REVIEW_RESULTS.includes(query.status)
        ? (query.status as SubmissionStatus)
        : undefined;
    const search = typeof query.search === "string" ? query.search.trim().slice(0, 100) : "";

    const reviewed = { reviewedById: mentorId, reviewedAt: { not: null } };
    const where = {
        ...reviewed,
        ...(courseId ? { assignment: { courseId } } : {}),
        ...(status ? { status } : {}),
        ...(search
            ? {
                student: {
                    OR: [
                        { name: { contains: search, mode: "insensitive" as const } },
                        { email: { contains: search, mode: "insensitive" as const } },
                    ],
                },
            }
            : {}),
    };

    const [rows, total, everything] = await Promise.all([
        prisma.assignmentSubmission.findMany({
            where,
            orderBy: { reviewedAt: "desc" },
            skip: (page - 1) * limit,
            take: limit,
            select: {
                id: true, status: true, score: true, maxScore: true, feedback: true,
                submissionUrl: true, fileUrls: true, submittedAt: true, reviewedAt: true,
                student: {
                    select: { id: true, name: true, email: true, image: true, learningProfile: { select: { studentId: true } } },
                },
                assignment: {
                    select: {
                        id: true, title: true, totalMarks: true, deadline: true,
                        milestone: { select: { title: true, order: true } },
                        course: { select: { id: true, title: true } },
                    },
                },
            },
        }),
        prisma.assignmentSubmission.count({ where }),
        // Light rows for the per-course summary, across everything they marked.
        prisma.assignmentSubmission.findMany({
            where: reviewed,
            select: {
                status: true, score: true, maxScore: true,
                assignment: { select: { totalMarks: true, course: { select: { id: true, title: true } } } },
            },
        }),
    ]);

    // Earlier reviews of the same submissions, from the change history.
    const history = await prisma.staffActivity.findMany({
        where: { actorId: mentorId, action: "submission.review", entityId: { in: rows.map((row) => row.id) } },
        orderBy: { createdAt: "asc" },
        select: { entityId: true, detail: true, createdAt: true },
    });
    const historyBy = new Map<string, { status: string | null; score: number | null; at: Date }[]>();
    for (const entry of history) {
        const detail = (entry.detail ?? {}) as { status?: unknown; score?: unknown };
        const list = historyBy.get(entry.entityId as string) ?? [];
        list.push({
            status: typeof detail.status === "string" ? detail.status : null,
            score: typeof detail.score === "number" ? detail.score : null,
            at: entry.createdAt,
        });
        historyBy.set(entry.entityId as string, list);
    }

    const byCourse = new Map<string, { id: string; title: string; reviews: number; accepted: number; percents: number[] }>();
    for (const row of everything) {
        const course = row.assignment.course;
        const summary = byCourse.get(course.id) ?? { ...course, reviews: 0, accepted: 0, percents: [] };
        summary.reviews += 1;
        if (row.status === SubmissionStatus.ACCEPTED) summary.accepted += 1;
        if (row.score !== null) {
            const percent = percentOf(row.score, row.maxScore, row.assignment.totalMarks);
            if (percent !== null) summary.percents.push(percent);
        }
        byCourse.set(course.id, summary);
    }

    return {
        data: rows.map(({ student, ...row }) => ({
            ...row,
            student: { id: student.id, name: student.name, email: student.email, image: student.image, studentId: student.learningProfile?.studentId ?? null },
            percent: row.score === null ? null : percentOf(row.score, row.maxScore, row.assignment.totalMarks),
            history: historyBy.get(row.id) ?? [],
        })),
        meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
        courses: [...byCourse.values()]
            .map(({ percents, ...course }) => ({
                ...course,
                scored: percents.length,
                averagePercent: percents.length
                    ? Math.round(percents.reduce((sum, value) => sum + value, 0) / percents.length)
                    : null,
            }))
            .sort((a, b) => b.reviews - a.reviews),
    };
};

/** Where the mentor is signed in: their live sessions, most recently used first. */
const getMentorDevices = async (_actor: IRequestUser, mentorId: string) => {
    await assertMentor(mentorId);

    const sessions = await prisma.session.findMany({
        where: { userId: mentorId, expiresAt: { gt: new Date() } },
        orderBy: { updatedAt: "desc" },
        select: { id: true, createdAt: true, updatedAt: true, expiresAt: true, ipAddress: true, userAgent: true },
    });
    return sessions.map(({ updatedAt, userAgent, ...session }) => ({
        ...session,
        lastActiveAt: updatedAt,
        ...describeUserAgent(userAgent),
        userAgent,
    }));
};

export const MentorDetailService = {
    getMentorOverview,
    getMentorActivity,
    getMentorReviews,
    getMentorDevices,
};
