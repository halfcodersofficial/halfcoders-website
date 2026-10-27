import status from "http-status";
import {
    CertificateStatus,
    EnrollmentStatus,
    OrderStatus,
    QuizAttemptStatus,
    SubmissionStatus,
    SupportQueueStatus,
} from "../../../generated/prisma/enums";
import AppError from "../../errorHelpers/AppError";
import { flattenLearner, learnerIdentitySelect, learnerScope } from "../../lib/learningProfile";
import { prisma } from "../../lib/prisma";
import { Role } from "../../lib/roles";
import { parseLateTiers } from "../../utils/lateWindows";
import { scoreProfileSections } from "../studentProfile/studentProfile.service";

/**
 * Everything about one student, for the admin's student detail page: the
 * whole profile they filled in, every course with how far they've got, each
 * assignment with its marks and who gave them (and each earlier marking, from
 * the change history), quizzes, practice days, payments, support visits and
 * XP. `getStudentCourse` opens one course week by week.
 */

const TREND_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;
const FEED_LIMIT = 40;
const QUIZ_ATTEMPT_LIMIT = 300;

/** A day as students and mentors in Bangladesh see it. */
const dhakaDay = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" });
const dayKey = (date: Date) => dhakaDay.format(date);

/** What a student can see of a course — the same rule progress is counted by. */
const publishedWeek = { isPublished: true, milestone: { isPublished: true } } as const;
const publishedLesson = { isPublished: true, module: { isPublished: true, milestone: { isPublished: true } } } as const;

const PENDING_REVIEW: string[] = [SubmissionStatus.SUBMITTED, SubmissionStatus.UNDER_REVIEW];

/** A score as a percentage of what the submission could earn (a late one's cap, else full marks). */
const percentOf = (score: number | null, maxScore: number | null, totalMarks: number) => {
    if (score === null) return null;
    const outOf = maxScore ?? totalMarks;
    return outOf > 0 ? Math.round((score / outOf) * 1000) / 10 : null;
};

const average = (values: number[]) =>
    values.length ? Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10 : null;

/** When an assignment stops taking first submissions: its last late window, else its deadline. */
const closesAt = (deadline: Date | null, lateTiers: unknown) => {
    if (!deadline) return null;
    const tiers = parseLateTiers(lateTiers);
    return tiers.length ? tiers[tiers.length - 1].until : deadline;
};

const latest = (...dates: (Date | null | undefined)[]) =>
    dates.filter((date): date is Date => Boolean(date)).sort((a, b) => b.getTime() - a.getTime())[0] ?? null;

const assertStudent = async (userId: string) => {
    const student = await prisma.user.findFirst({
        where: { id: userId, ...learnerScope(Role.STUDENT) },
        select: { id: true },
    });
    if (!student) throw new AppError(status.NOT_FOUND, "Student not found.");
};

/**
 * The newest thing each student did — watched a lesson, handed in work, took
 * a quiz, ticked off a practice day. For the register's "last active" line.
 */
export const lastLearningActivity = async (studentIds: string[]) => {
    const latestBy = new Map<string, Date>();
    if (studentIds.length === 0) return latestBy;

    const where = { studentId: { in: studentIds } };
    const [watched, submitted, quizzes, practice] = await Promise.all([
        prisma.videoProgress.groupBy({ by: ["studentId"], where, _max: { updatedAt: true } }),
        prisma.assignmentSubmission.groupBy({ by: ["studentId"], where, _max: { submittedAt: true } }),
        prisma.quizAttempt.groupBy({ by: ["studentId"], where, _max: { startedAt: true } }),
        prisma.practiceCompletion.groupBy({ by: ["studentId"], where, _max: { completedAt: true } }),
    ]);

    const note = (studentId: string, date: Date | null) => {
        const current = latestBy.get(studentId);
        if (date && (!current || date > current)) latestBy.set(studentId, date);
    };
    for (const row of watched) note(row.studentId, row._max.updatedAt);
    for (const row of submitted) note(row.studentId, row._max.submittedAt);
    for (const row of quizzes) note(row.studentId, row._max.startedAt);
    for (const row of practice) note(row.studentId, row._max.completedAt);

    return latestBy;
};

// ── Submissions, with who marked them ───────────────────────────────────────

const submissionSelect = {
    id: true,
    enrollmentId: true,
    status: true,
    score: true,
    maxScore: true,
    feedback: true,
    content: true,
    submissionUrl: true,
    fileUrls: true,
    submittedAt: true,
    updatedAt: true,
    reviewedAt: true,
    reviewedBy: { select: { id: true, name: true, image: true, role: true } },
    assignment: {
        select: {
            id: true,
            title: true,
            totalMarks: true,
            deadline: true,
            milestone: { select: { id: true, title: true, order: true } },
            course: { select: { id: true, title: true, milestoneLabel: true } },
        },
    },
} as const;

type SubmissionRow = Awaited<ReturnType<typeof findSubmissions>>[number];

const findSubmissions = (where: { studentId: string; enrollmentId?: string }) =>
    prisma.assignmentSubmission.findMany({ where, orderBy: { submittedAt: "desc" }, select: submissionSelect });

/**
 * Each time a submission was marked, oldest first, with who marked it — from
 * the change history, so only as far back as that table goes. The submission
 * row itself keeps just the latest marks.
 */
const markingHistory = async (submissionIds: string[]) => {
    const byId = new Map<
        string,
        { status: string | null; score: number | null; at: Date; by: { id: string; name: string; image: string | null; role: Role | null } }[]
    >();
    if (submissionIds.length === 0) return byId;

    const entries = await prisma.staffActivity.findMany({
        where: { action: "submission.review", entityId: { in: submissionIds } },
        orderBy: { createdAt: "asc" },
        select: {
            entityId: true,
            detail: true,
            createdAt: true,
            actor: { select: { id: true, name: true, image: true, role: true } },
        },
    });

    for (const entry of entries) {
        const detail = (entry.detail ?? {}) as { status?: unknown; score?: unknown };
        const list = byId.get(entry.entityId as string) ?? [];
        list.push({
            status: typeof detail.status === "string" && detail.status ? detail.status : null,
            score: typeof detail.score === "number" ? detail.score : null,
            at: entry.createdAt,
            by: entry.actor,
        });
        byId.set(entry.entityId as string, list);
    }
    return byId;
};

const toSubmission = (
    { reviewedBy, ...row }: SubmissionRow,
    history: Awaited<ReturnType<typeof markingHistory>>,
) => ({
    ...row,
    reviewedBy: reviewedBy ?? null,
    /** Marked out of a late window's cap rather than the full marks. */
    late: row.maxScore !== null && row.maxScore < row.assignment.totalMarks,
    percent: percentOf(row.score, row.maxScore, row.assignment.totalMarks),
    history: history.get(row.id) ?? [],
});

// ── Overview ────────────────────────────────────────────────────────────────

const getStudentOverview = async (userId: string) => {

    const record = await prisma.user.findFirst({
        where: { id: userId, ...learnerScope(Role.STUDENT) },
        select: {
            ...learnerIdentitySelect,
            phoneVerified: true,
            status: true,
            learningProfile: {
                select: {
                    status: true, studentId: true, createdAt: true, whatsapp: true, bio: true, address: true,
                    preferences: true,
                },
            },
            additionalInfo: true,
            studentAddress: true,
            education: true,
            links: true,
            jobProfile: true,
            projects: { orderBy: { order: "asc" } },
            skills: { orderBy: { order: "asc" } },
            jobExperiences: { orderBy: { order: "asc" } },
            hiredRecords: { orderBy: { order: "asc" } },
            courseRequests: { orderBy: { createdAt: "desc" } },
        },
    });
    if (!record) throw new AppError(status.NOT_FOUND, "Student not found.");

    const {
        status: accountStatus,
        additionalInfo,
        studentAddress,
        education,
        links,
        jobProfile,
        projects,
        skills,
        jobExperiences,
        hiredRecords,
        courseRequests,
        ...identity
    } = record;
    const student = {
        ...flattenLearner(identity),
        email: identity.email,
        /** Account-wide status; `status` is the learning-only one. */
        accountStatus,
    };

    const now = new Date();
    const since = new Date(now.getTime() - TREND_DAYS * DAY_MS);
    const mine = { studentId: userId };

    const enrollments = await prisma.enrollment.findMany({
        where: mine,
        orderBy: { createdAt: "desc" },
        select: {
            id: true, courseId: true, status: true, progress: true, startedAt: true, completedAt: true,
            expiresAt: true, createdAt: true, updatedAt: true,
            course: {
                select: {
                    id: true, title: true, slug: true, thumbnail: true, courseType: true, status: true,
                    milestoneLabel: true, moduleLabel: true,
                },
            },
            currentMilestone: { select: { id: true, title: true, order: true } },
            currentModule: { select: { id: true, title: true, order: true } },
            certificate: { select: { id: true, certificateNo: true, issuedAt: true, status: true } },
            order: { select: { id: true, orderNumber: true, total: true, status: true } },
        },
    });
    const courseIds = enrollments.map((enrollment) => enrollment.courseId);
    const inTheirCourses = { courseId: { in: courseIds } };

    const [
        lessonTotals,
        lessonsDone,
        lastWatched,
        assignments,
        quizzes,
        practiceTotals,
        practiceDone,
        submissionRows,
        quizAttempts,
        orders,
        supportVisits,
        courseXp,
        xpBySource,
        xpRecent,
        testimonials,
        notes,
        bookmarks,
        reactions,
        recentLessons,
        recentPractice,
        trendLessons,
    ] = await Promise.all([
        prisma.video.groupBy({ by: ["courseId"], where: { ...inTheirCourses, ...publishedLesson }, _count: { _all: true } }),
        prisma.videoProgress.groupBy({
            by: ["enrollmentId"],
            where: { ...mine, isCompleted: true, video: publishedLesson },
            _count: { _all: true },
        }),
        prisma.videoProgress.groupBy({ by: ["enrollmentId"], where: mine, _max: { updatedAt: true } }),
        prisma.assignment.findMany({
            where: { ...inTheirCourses, ...publishedWeek },
            select: { id: true, courseId: true, deadline: true, lateTiers: true },
        }),
        prisma.quiz.findMany({
            where: { ...inTheirCourses, isPublished: true, module: publishedWeek },
            select: { id: true, courseId: true },
        }),
        prisma.practiceDay.groupBy({ by: ["courseId"], where: { ...inTheirCourses, ...publishedWeek }, _count: { _all: true } }),
        prisma.practiceCompletion.findMany({
            where: mine,
            select: { enrollmentId: true, completedAt: true },
        }),
        findSubmissions(mine),
        prisma.quizAttempt.findMany({
            where: mine,
            orderBy: { startedAt: "desc" },
            take: QUIZ_ATTEMPT_LIMIT,
            select: {
                id: true, enrollmentId: true, status: true, totalQuestions: true, correctCount: true,
                incorrectCount: true, percentage: true, startedAt: true, completedAt: true,
                quiz: {
                    select: {
                        id: true, title: true,
                        module: { select: { title: true, order: true, milestone: { select: { title: true, order: true } } } },
                        course: { select: { id: true, title: true, milestoneLabel: true, moduleLabel: true } },
                    },
                },
            },
        }),
        prisma.order.findMany({
            where: mine,
            orderBy: { createdAt: "desc" },
            select: {
                id: true, orderNumber: true, amount: true, discount: true, total: true, couponCode: true,
                status: true, createdAt: true,
                course: { select: { id: true, title: true } },
                payment: {
                    select: {
                        gateway: true, transactionId: true, amount: true, status: true, paidAt: true,
                        failureReason: true,
                    },
                },
            },
        }),
        prisma.supportQueue.findMany({
            where: mine,
            orderBy: { joinedAt: "desc" },
            select: {
                id: true, queueNumber: true, status: true, topic: true, joinedAt: true, servedAt: true,
                completedAt: true, mentorNote: true,
                session: {
                    select: {
                        id: true, title: true, startTime: true, endTime: true, status: true,
                        course: { select: { id: true, title: true } },
                        mentor: { select: { id: true, name: true, image: true } },
                    },
                },
            },
        }),
        prisma.courseXp.findMany({ where: mine, select: { courseId: true, totalXp: true } }),
        prisma.xpTransaction.groupBy({ by: ["source"], where: mine, _sum: { points: true }, _count: { _all: true } }),
        prisma.xpTransaction.findMany({
            where: mine,
            orderBy: { createdAt: "desc" },
            take: 30,
            select: { id: true, source: true, points: true, note: true, createdAt: true, course: { select: { id: true, title: true } } },
        }),
        prisma.testimonial.findMany({
            where: mine,
            orderBy: { createdAt: "desc" },
            select: {
                id: true, quote: true, rating: true, videoUrl: true, isPublished: true, createdAt: true,
                course: { select: { id: true, title: true } },
            },
        }),
        prisma.lessonNote.count({ where: mine }),
        prisma.lessonInteraction.count({ where: { ...mine, isBookmarked: true } }),
        prisma.lessonInteraction.groupBy({ by: ["reaction"], where: { ...mine, reaction: { not: null } }, _count: { _all: true } }),
        prisma.videoProgress.findMany({
            where: { ...mine, isCompleted: true, completedAt: { not: null } },
            orderBy: { completedAt: "desc" },
            take: FEED_LIMIT,
            select: {
                id: true, completedAt: true,
                video: { select: { title: true, course: { select: { id: true, title: true } } } },
            },
        }),
        prisma.practiceCompletion.findMany({
            where: mine,
            orderBy: { completedAt: "desc" },
            take: FEED_LIMIT,
            select: {
                id: true, completedAt: true, note: true,
                practiceDay: { select: { title: true, course: { select: { id: true, title: true } } } },
            },
        }),
        prisma.videoProgress.findMany({
            where: { ...mine, isCompleted: true, completedAt: { gte: since } },
            select: { completedAt: true },
        }),
    ]);

    const history = await markingHistory(submissionRows.map((row) => row.id));
    const submissions = submissionRows.map((row) => toSubmission(row, history));

    // ---- Per course
    const lessonTotalBy = new Map(lessonTotals.map((row) => [row.courseId, row._count._all]));
    const lessonsDoneBy = new Map(lessonsDone.map((row) => [row.enrollmentId, row._count._all]));
    const lastWatchedBy = new Map(lastWatched.map((row) => [row.enrollmentId, row._max.updatedAt]));
    const practiceTotalBy = new Map(practiceTotals.map((row) => [row.courseId, row._count._all]));
    const xpBy = new Map(courseXp.map((row) => [row.courseId, row.totalXp]));
    const submittedIds = new Set(submissionRows.map((row) => row.assignment.id));

    const perCourse = enrollments.map((enrollment) => {
        const courseAssignments = assignments.filter((assignment) => assignment.courseId === enrollment.courseId);
        const courseSubmissions = submissions.filter((row) => row.enrollmentId === enrollment.id);
        const marked = courseSubmissions.map((row) => row.percent).filter((value): value is number => value !== null);
        const missed = courseAssignments.filter((assignment) => {
            const closes = closesAt(assignment.deadline, assignment.lateTiers);
            return closes !== null && closes < now && !submittedIds.has(assignment.id);
        }).length;

        const courseQuizIds = new Set(quizzes.filter((quiz) => quiz.courseId === enrollment.courseId).map((quiz) => quiz.id));
        const bestByQuiz = new Map<string, number>();
        for (const attempt of quizAttempts) {
            if (attempt.enrollmentId !== enrollment.id || attempt.status !== QuizAttemptStatus.COMPLETED) continue;
            bestByQuiz.set(attempt.quiz.id, Math.max(bestByQuiz.get(attempt.quiz.id) ?? 0, attempt.percentage));
        }

        const practiceMine = practiceDone.filter((row) => row.enrollmentId === enrollment.id);
        const lastActivityAt = latest(
            lastWatchedBy.get(enrollment.id),
            courseSubmissions[0]?.submittedAt,
            quizAttempts.find((attempt) => attempt.enrollmentId === enrollment.id)?.startedAt,
            practiceMine.reduce<Date | null>((max, row) => (!max || row.completedAt > max ? row.completedAt : max), null),
        );

        return {
            ...enrollment,
            lessons: { completed: lessonsDoneBy.get(enrollment.id) ?? 0, total: lessonTotalBy.get(enrollment.courseId) ?? 0 },
            assignments: {
                total: courseAssignments.length,
                submitted: courseSubmissions.length,
                accepted: courseSubmissions.filter((row) => row.status === SubmissionStatus.ACCEPTED).length,
                awaitingReview: courseSubmissions.filter((row) => PENDING_REVIEW.includes(row.status)).length,
                needsRevision: courseSubmissions.filter((row) => row.status === SubmissionStatus.NEEDS_REVISION).length,
                missed,
                averagePercent: average(marked),
            },
            quizzes: {
                total: courseQuizIds.size,
                taken: [...bestByQuiz.keys()].filter((id) => courseQuizIds.has(id)).length,
                averagePercent: average([...bestByQuiz.values()]),
            },
            practice: { total: practiceTotalBy.get(enrollment.courseId) ?? 0, completed: practiceMine.length },
            xp: xpBy.get(enrollment.courseId) ?? 0,
            lastActivityAt,
        };
    });

    // ---- The last 30 days, day by day
    const days = Array.from({ length: TREND_DAYS }, (_, index) =>
        dayKey(new Date(now.getTime() - (TREND_DAYS - 1 - index) * DAY_MS)),
    );
    const tally = (dates: (Date | null)[]) => {
        const counts = new Map<string, number>();
        for (const date of dates) {
            if (!date || date < since) continue;
            counts.set(dayKey(date), (counts.get(dayKey(date)) ?? 0) + 1);
        }
        return counts;
    };
    const lessonsByDay = tally(trendLessons.map((row) => row.completedAt));
    const submissionsByDay = tally(submissionRows.map((row) => row.submittedAt));
    const quizzesByDay = tally(quizAttempts.map((row) => row.completedAt));
    const practiceByDay = tally(practiceDone.map((row) => row.completedAt));
    const trend = days.map((date) => ({
        date,
        lessons: lessonsByDay.get(date) ?? 0,
        submissions: submissionsByDay.get(date) ?? 0,
        quizzes: quizzesByDay.get(date) ?? 0,
        practice: practiceByDay.get(date) ?? 0,
    }));

    // ---- One feed of what they did, newest first
    type FeedEntry = {
        id: string;
        kind: string;
        at: Date;
        title: string;
        course: { id: string; title: string } | null;
        detail?: string | null;
        /** Taka, for a payment. */
        amount?: number;
        by?: { id: string; name: string; image: string | null } | null;
    };
    const courseOf = (id: string) => enrollments.find((enrollment) => enrollment.courseId === id)?.course ?? null;
    const feed: FeedEntry[] = [
        ...recentLessons.map((row) => ({
            id: `lesson-${row.id}`, kind: "lesson", at: row.completedAt as Date, title: row.video.title,
            course: row.video.course,
        })),
        ...submissionRows.map((row) => ({
            id: `submit-${row.id}`, kind: "submission", at: row.submittedAt, title: row.assignment.title,
            course: row.assignment.course,
        })),
        ...submissions
            .filter((row) => row.reviewedAt)
            .map((row) => ({
                id: `review-${row.id}`, kind: "review", at: row.reviewedAt as Date, title: row.assignment.title,
                course: row.assignment.course,
                detail: row.score !== null ? `${row.score} / ${row.maxScore ?? row.assignment.totalMarks}` : null,
                by: row.reviewedBy,
            })),
        ...quizAttempts
            .filter((row) => row.completedAt)
            .map((row) => ({
                id: `quiz-${row.id}`, kind: "quiz", at: row.completedAt as Date, title: row.quiz.title,
                course: row.quiz.course, detail: `${row.percentage}%`,
            })),
        ...recentPractice.map((row) => ({
            id: `practice-${row.id}`, kind: "practice", at: row.completedAt, title: row.practiceDay.title,
            course: row.practiceDay.course,
        })),
        ...supportVisits.map((row) => ({
            id: `support-${row.id}`, kind: "support", at: row.joinedAt, title: row.session.title || "Support session",
            course: row.session.course, detail: row.topic, by: row.session.mentor,
        })),
        ...enrollments.map((row) => ({
            id: `enrol-${row.id}`, kind: "enrolled", at: row.createdAt, title: row.course.title, course: courseOf(row.courseId),
        })),
        ...enrollments
            .filter((row) => row.certificate)
            .map((row) => ({
                id: `certificate-${row.id}`, kind: "certificate", at: row.certificate!.issuedAt, title: row.course.title,
                course: courseOf(row.courseId), detail: row.certificate!.certificateNo,
            })),
        ...orders
            .filter((row) => row.payment?.paidAt)
            .map((row) => ({
                id: `paid-${row.id}`, kind: "payment", at: row.payment!.paidAt as Date, title: row.course.title,
                course: row.course, amount: row.total,
            })),
    ]
        .sort((a, b) => b.at.getTime() - a.at.getTime())
        .slice(0, FEED_LIMIT);

    // ---- The numbers
    const live = perCourse.filter((row) => row.status !== EnrollmentStatus.CANCELLED);
    const markedPercents = submissions.map((row) => row.percent).filter((value): value is number => value !== null);
    const completedAttempts = quizAttempts.filter((row) => row.status === QuizAttemptStatus.COMPLETED);
    const paidOrders = orders.filter((row) => row.status === OrderStatus.PAID);
    const totalXp = courseXp.reduce((sum, row) => sum + row.totalXp, 0);
    const skillCount = skills.length;

    return {
        student,
        profile: {
            additionalInfo,
            address: studentAddress,
            education,
            links,
            jobProfile,
            projects,
            skills,
            jobExperiences,
            hiredRecords,
            courseRequests,
            ...scoreProfileSections({
                profile: { name: student.name, phone: student.phone, whatsapp: student.whatsapp },
                additionalInfo,
                address: studentAddress,
                education,
                links,
                jobProfile,
                skillCount,
            }),
        },
        stats: {
            courses: {
                total: enrollments.length,
                active: perCourse.filter((row) => row.status === EnrollmentStatus.ACTIVE).length,
                completed: perCourse.filter((row) => row.status === EnrollmentStatus.COMPLETED).length,
            },
            averageProgress: live.length
                ? Math.round(live.reduce((sum, row) => sum + row.progress, 0) / live.length)
                : null,
            lessonsCompleted: perCourse.reduce((sum, row) => sum + row.lessons.completed, 0),
            assignments: {
                submitted: submissions.length,
                marked: markedPercents.length,
                awaitingReview: submissions.filter((row) => PENDING_REVIEW.includes(row.status)).length,
                missed: perCourse.reduce((sum, row) => sum + row.assignments.missed, 0),
                averagePercent: average(markedPercents),
            },
            quizzes: {
                attempts: completedAttempts.length,
                averagePercent: average(completedAttempts.map((row) => row.percentage)),
            },
            certificates: enrollments.filter((row) => row.certificate?.status === CertificateStatus.ISSUED).length,
            xp: totalXp,
            support: {
                visits: supportVisits.length,
                helped: supportVisits.filter((row) => row.status === SupportQueueStatus.COMPLETED).length,
            },
            paid: paidOrders.reduce((sum, row) => sum + row.total, 0),
            lastActivityAt: latest(...perCourse.map((row) => row.lastActivityAt)),
        },
        enrollments: perCourse,
        submissions,
        quizAttempts,
        orders,
        support: supportVisits,
        xp: {
            total: totalXp,
            bySource: xpBySource
                .map((row) => ({ source: row.source, points: row._sum.points ?? 0, count: row._count._all }))
                .sort((a, b) => b.points - a.points),
            recent: xpRecent,
        },
        testimonials,
        engagement: {
            notes,
            bookmarks,
            likes: reactions.find((row) => row.reaction === "LIKE")?._count._all ?? 0,
            dislikes: reactions.find((row) => row.reaction === "DISLIKE")?._count._all ?? 0,
        },
        trend,
        feed,
    };
};

// ── One course, week by week ────────────────────────────────────────────────

const getStudentCourse = async (userId: string, courseId: string) => {
    await assertStudent(userId);

    const enrollment = await prisma.enrollment.findUnique({
        where: { studentId_courseId: { studentId: userId, courseId } },
        select: {
            id: true, status: true, progress: true, currentMilestoneId: true, currentModuleId: true,
            course: { select: { id: true, title: true, slug: true, courseType: true, milestoneLabel: true, moduleLabel: true } },
        },
    });
    if (!enrollment) throw new AppError(status.NOT_FOUND, "This student isn't enrolled in that course.");

    const byEnrollment = { enrollmentId: enrollment.id };
    const [weeks, watched, moduleRows, weekRows, submissionRows, attempts, completions] = await Promise.all([
        prisma.milestone.findMany({
            where: { courseId, isPublished: true },
            orderBy: { order: "asc" },
            select: {
                id: true, title: true, order: true,
                modules: {
                    where: { isPublished: true },
                    select: {
                        id: true, title: true, order: true, position: true, publishedAt: true,
                        videos: {
                            where: { isPublished: true },
                            orderBy: { order: "asc" },
                            select: { id: true, title: true, type: true, duration: true },
                        },
                        quizzes: {
                            where: { isPublished: true },
                            select: { id: true, title: true, _count: { select: { questions: true } } },
                        },
                    },
                },
                assignments: {
                    where: { isPublished: true },
                    select: {
                        id: true, title: true, totalMarks: true, deadline: true, lateTiers: true, position: true,
                        publishedAt: true,
                    },
                },
                practiceDays: {
                    where: { isPublished: true },
                    select: { id: true, title: true, position: true, publishedAt: true },
                },
            },
        }),
        prisma.videoProgress.findMany({
            where: byEnrollment,
            select: { videoId: true, isCompleted: true, watchedSeconds: true, completedAt: true, updatedAt: true },
        }),
        prisma.moduleProgress.findMany({
            where: byEnrollment,
            select: { moduleId: true, completedVideos: true, totalVideos: true, progress: true, isCompleted: true, completedAt: true },
        }),
        prisma.milestoneProgress.findMany({
            where: byEnrollment,
            select: { milestoneId: true, completedModules: true, totalModules: true, progress: true, isCompleted: true, completedAt: true },
        }),
        findSubmissions({ studentId: userId, enrollmentId: enrollment.id }),
        prisma.quizAttempt.findMany({
            where: byEnrollment,
            orderBy: { startedAt: "asc" },
            select: {
                id: true, quizId: true, status: true, totalQuestions: true, correctCount: true, percentage: true,
                startedAt: true, completedAt: true,
            },
        }),
        prisma.practiceCompletion.findMany({
            where: byEnrollment,
            select: { practiceDayId: true, completedAt: true, note: true },
        }),
    ]);

    const history = await markingHistory(submissionRows.map((row) => row.id));
    const now = new Date();
    const watchedBy = new Map(watched.map((row) => [row.videoId, row]));
    const moduleBy = new Map(moduleRows.map((row) => [row.moduleId, row]));
    const weekBy = new Map(weekRows.map((row) => [row.milestoneId, row]));
    const submissionBy = new Map(submissionRows.map((row) => [row.assignment.id, toSubmission(row, history)]));
    const completionBy = new Map(completions.map((row) => [row.practiceDayId, row]));

    return {
        enrollment,
        weeks: weeks.map((week) => {
            const modules = week.modules.map((courseModule) => {
                const lessons = courseModule.videos.map((video) => {
                    const progress = watchedBy.get(video.id);
                    return {
                        ...video,
                        completed: progress?.isCompleted ?? false,
                        completedAt: progress?.completedAt ?? null,
                        watchedSeconds: progress?.watchedSeconds ?? 0,
                        lastWatchedAt: progress?.updatedAt ?? null,
                    };
                });
                const quiz = courseModule.quizzes[0];
                const quizAttempts = quiz ? attempts.filter((attempt) => attempt.quizId === quiz.id) : [];
                const scores = quizAttempts
                    .filter((attempt) => attempt.status === QuizAttemptStatus.COMPLETED)
                    .map((attempt) => attempt.percentage);

                return {
                    kind: "module" as const,
                    id: courseModule.id,
                    title: courseModule.title,
                    order: courseModule.order,
                    position: courseModule.position,
                    publishedAt: courseModule.publishedAt,
                    isCurrent: courseModule.id === enrollment.currentModuleId,
                    lessons,
                    completedLessons: lessons.filter((lesson) => lesson.completed).length,
                    progress: moduleBy.get(courseModule.id)?.progress ?? 0,
                    completedAt: moduleBy.get(courseModule.id)?.completedAt ?? null,
                    quiz: quiz
                        ? {
                            id: quiz.id,
                            title: quiz.title,
                            questions: quiz._count.questions,
                            attempts: quizAttempts,
                            bestPercent: scores.length ? Math.max(...scores) : null,
                        }
                        : null,
                };
            });

            const assignments = week.assignments.map(({ lateTiers, ...assignment }) => {
                const closes = closesAt(assignment.deadline, lateTiers);
                const submission = submissionBy.get(assignment.id) ?? null;
                return {
                    kind: "assignment" as const,
                    ...assignment,
                    closesAt: closes,
                    /** Closed without anything handed in. */
                    missed: !submission && closes !== null && closes < now,
                    submission,
                };
            });

            const practiceDays = week.practiceDays.map((practice) => ({
                kind: "practice" as const,
                ...practice,
                completion: completionBy.get(practice.id) ?? null,
            }));

            const progress = weekBy.get(week.id);
            return {
                id: week.id,
                title: week.title,
                order: week.order,
                isCurrent: week.id === enrollment.currentMilestoneId,
                progress: progress?.progress ?? 0,
                completedAt: progress?.completedAt ?? null,
                // The week's one mixed list, in the order students see it.
                items: [...modules, ...assignments, ...practiceDays].sort((a, b) => a.position - b.position),
            };
        }),
    };
};

export const StudentDetailService = {
    getStudentOverview,
    getStudentCourse,
};
