import {
    CertificateStatus,
    CourseStatus,
    CourseType,
    EnrollmentStatus,
    LearningStatus,
    OrderStatus,
    SubmissionStatus,
    SupportQueueStatus,
    SupportSessionStatus,
} from "../../../generated/prisma/enums";
import { IRequestUser } from "../../interfaces/requestUser.interface";
import { Role } from "../../lib/roles";
import { learnerScope } from "../../lib/learningProfile";
import { prisma } from "../../lib/prisma";
import { STUDENT_NAME_ONLY } from "../../lib/studentPrivacy";
import { rewardMainCourses } from "../../utils/courseGrants";
import { isSequentialLearningEnabled } from "../../utils/platformSettings";
import { computeLive } from "../support/support.service";

/** Midnight UTC, `daysAgo` days before today — the boundary for a "day" of activity. */
const utcDayStart = (daysAgo: number) => {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    d.setUTCDate(d.getUTCDate() - daysAgo);
    return d;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** One event on the streak calendar — oldest first, so a month grid can page through it. */
interface StreakDay {
    date: string;
    isActive: boolean;
}

/**
 * Traditional courses: the old "watch something today/yesterday, then walk
 * consecutive days backward" rule, just scoped to one enrollment's own
 * activity instead of the whole student's. `history` is every active date
 * on record — there's no "missed" state to show for Traditional (any day
 * without activity is just a plain calendar day), so only active ones are
 * worth sending.
 */
const traditionalStreak = (activeDays: Set<string>) => {
    const streakStart = activeDays.has(utcDayStart(0).toISOString().slice(0, 10))
        ? 0
        : activeDays.has(utcDayStart(1).toISOString().slice(0, 10))
            ? 1
            : null;

    let currentStreakDays = 0;
    if (streakStart !== null) {
        let daysAgo = streakStart;
        while (activeDays.has(utcDayStart(daysAgo).toISOString().slice(0, 10))) {
            currentStreakDays += 1;
            daysAgo += 1;
        }
    }

    const history: StreakDay[] = Array.from(activeDays)
        .sort()
        .map((date) => ({ date, isActive: true }));

    return { currentStreakDays, history };
};

/**
 * Bootcamp courses: a calendar day only matters here if a module actually
 * released on it (`CourseModule.publishedAt` — the same timestamp the
 * real-time outline's "Publish Date" column reads off), so days with no
 * release are simply absent from `modules` and never break or extend the
 * streak. Walking most-recent-first: watched within 24h of its own release
 * counts and continues; still inside that 24h window but not watched yet is
 * a grace period (skip, don't break — mirrors "today isn't over"); a window
 * that has closed unwatched stops the walk. An overdue, unsubmitted
 * assignment on the course zeroes the streak outright, but `history` still
 * shows the raw watched-in-window facts per module regardless of that gate —
 * otherwise a missed deadline would hide genuine watch activity. Every
 * release is included, watched or not, so a calendar can tell "missed" from
 * "nothing released that day".
 */
const bootcampStreak = (
    modules: { id: string; publishedAt: Date }[],
    firstWatchByModule: Map<string, Date>,
    hasOverdueAssignment: boolean,
) => {
    const now = new Date();
    const watchedInWindow = (m: { id: string; publishedAt: Date }) => {
        const windowEnd = new Date(m.publishedAt.getTime() + DAY_MS);
        const firstWatch = firstWatchByModule.get(m.id);
        return Boolean(firstWatch && firstWatch >= m.publishedAt && firstWatch <= windowEnd);
    };

    let currentStreakDays = 0;
    if (!hasOverdueAssignment) {
        for (const m of modules) {
            const windowEnd = new Date(m.publishedAt.getTime() + DAY_MS);
            if (watchedInWindow(m)) {
                currentStreakDays += 1;
                continue;
            }
            if (now < windowEnd) continue;
            break;
        }
    }

    // `modules` arrives most-recent-first; a calendar reads oldest to newest.
    const history: StreakDay[] = modules
        .slice()
        .reverse()
        .map((m) => ({ date: m.publishedAt.toISOString().slice(0, 10), isActive: watchedInWindow(m) }));

    return { currentStreakDays, history };
};

/**
 * What "Up next" on the student dashboard opens, in detail: the lesson the
 * course player will start on — the first unfinished one the student may
 * play, found with the same walk and the same sequential-learning lock as
 * `LearningService.getCourseLearning` — and the course as a row of its
 * milestones with how many of each one's lessons are done.
 */
const getUpNext = async (enrollmentId: string, courseId: string) => {
    const [milestones, videoProgress, moduleProgress, sequential] = await Promise.all([
        prisma.milestone.findMany({
            where: { courseId, isPublished: true },
            orderBy: { order: "asc" },
            select: {
                id: true, title: true, order: true,
                modules: {
                    where: { isPublished: true },
                    orderBy: { order: "asc" },
                    select: {
                        id: true, title: true, order: true,
                        videos: {
                            where: { isPublished: true },
                            orderBy: { order: "asc" },
                            select: { id: true, title: true, type: true, duration: true },
                        },
                    },
                },
            },
        }),
        prisma.videoProgress.findMany({
            where: { enrollmentId },
            select: { videoId: true, isCompleted: true, watchedSeconds: true },
        }),
        prisma.moduleProgress.findMany({
            where: { enrollmentId, isCompleted: true },
            select: { moduleId: true },
        }),
        isSequentialLearningEnabled(),
    ]);

    const progressByVideo = new Map(videoProgress.map((p) => [p.videoId, p]));
    const completedModules = new Set(moduleProgress.map((p) => p.moduleId));

    type NextLesson = (typeof milestones)[number]["modules"][number]["videos"][number] & {
        watchedSeconds: number;
        /** Its place in the whole course, counting from 1. */
        number: number;
        milestone: { id: string; title: string; order: number };
        module: { id: string; title: string; order: number };
    };

    let previousModulesComplete = true;
    let lessonNumber = 0;
    let completedLessons = 0;
    let nextLesson: NextLesson | null = null;
    const milestoneRoute: { id: string; title: string; order: number; totalLessons: number; completedLessons: number }[] = [];

    // A loop rather than .map(), so TypeScript sees `nextLesson` assigned.
    for (const milestone of milestones) {
        let total = 0;
        let completed = 0;

        for (const courseModule of milestone.modules) {
            const isLocked = sequential && !previousModulesComplete;
            if (!completedModules.has(courseModule.id)) previousModulesComplete = false;

            for (const video of courseModule.videos) {
                lessonNumber += 1;
                total += 1;
                const progress = progressByVideo.get(video.id);
                if (progress?.isCompleted) {
                    completed += 1;
                    continue;
                }
                if (!nextLesson && !isLocked) {
                    nextLesson = {
                        ...video,
                        watchedSeconds: progress?.watchedSeconds ?? 0,
                        number: lessonNumber,
                        milestone: { id: milestone.id, title: milestone.title, order: milestone.order },
                        module: { id: courseModule.id, title: courseModule.title, order: courseModule.order },
                    };
                }
            }
        }

        completedLessons += completed;
        milestoneRoute.push({ id: milestone.id, title: milestone.title, order: milestone.order, totalLessons: total, completedLessons: completed });
    }

    return { nextLesson, milestones: milestoneRoute, totalLessons: lessonNumber, completedLessons };
};

/** Student dashboard (plan §14). */
const getStudentDashboard = async (user: IRequestUser) => {
    const [enrollments, unreadNotifications, certificates, xp, rewardsWith] = await Promise.all([
        prisma.enrollment.findMany({
            where: { studentId: user.userId, status: { not: EnrollmentStatus.CANCELLED } },
            orderBy: { updatedAt: "desc" },
            include: {
                course: {
                    select: {
                        id: true, title: true, slug: true, thumbnail: true, duration: true, courseType: true,
                        // Support's course picker leaves out a previous course, which has no sessions.
                        phase: true,
                        // So the dashboard says "Week 03" where the course calls its milestones weeks.
                        milestoneLabel: true, moduleLabel: true,
                        _count: { select: { videos: true } },
                        admissionTicket: { select: { isActive: true } },
                    },
                },
                currentModule: { select: { id: true, title: true, order: true } },
                currentMilestone: { select: { id: true, title: true, order: true } },
                certificate: { select: { id: true, certificateNo: true, issuedAt: true } },
            },
        }),
        prisma.notification.count({ where: { userId: user.userId, isRead: false } }),
        prisma.certificate.count({
            where: { studentId: user.userId, status: CertificateStatus.ISSUED },
        }),
        prisma.courseXp.aggregate({
            where: { studentId: user.userId },
            _sum: { totalXp: true },
        }),
        // Courses held as a reward with another — the dashboard lists them on their own.
        rewardMainCourses(user.userId),
    ]);

    // Learning streak — Bootcamp and Traditional courses earn it differently
    // (plan: Bootcamp gates on module-release timing + assignment deadlines,
    // Traditional just on watch activity), and it's shown per enrolled
    // course rather than as one shared number, so it's computed per
    // enrollment right below rather than as a single dashboard-wide query.
    const traditionalEnrollments = enrollments.filter((e) => e.course.courseType === CourseType.TRADITIONAL);
    const bootcampEnrollments = enrollments.filter((e) => e.course.courseType === CourseType.BOOTCAMP);
    const bootcampCourseIds = bootcampEnrollments.map((e) => e.courseId);

    const now = new Date();
    const [traditionalProgress, bootcampModules, bootcampProgress, overdueAssignmentCourses] = await Promise.all([
        // No date floor: `@@unique([enrollmentId, videoId])` caps this at one
        // row per video in the course, so it's cheap even across a whole
        // enrollment's history — and the streak calendar needs that full
        // history to page back through past months.
        traditionalEnrollments.length
            ? prisma.videoProgress.findMany({
                where: { enrollmentId: { in: traditionalEnrollments.map((e) => e.id) } },
                select: { enrollmentId: true, updatedAt: true },
            })
            : Promise.resolve([]),
        bootcampCourseIds.length
            ? prisma.courseModule.findMany({
                where: { courseId: { in: bootcampCourseIds }, isPublished: true, publishedAt: { not: null } },
                orderBy: { publishedAt: "desc" },
                select: { id: true, courseId: true, publishedAt: true },
            })
            : Promise.resolve([]),
        bootcampEnrollments.length
            ? prisma.videoProgress.findMany({
                where: { enrollmentId: { in: bootcampEnrollments.map((e) => e.id) } },
                select: { enrollmentId: true, moduleId: true, updatedAt: true },
            })
            : Promise.resolve([]),
        // "On time" isn't a stored flag anywhere — a course counts as overdue
        // the moment any published assignment's deadline has passed with no
        // submission from this student for it.
        bootcampCourseIds.length
            ? prisma.assignment.groupBy({
                by: ["courseId"],
                where: {
                    courseId: { in: bootcampCourseIds },
                    isPublished: true,
                    deadline: { lt: now },
                    submissions: { none: { studentId: user.userId } },
                },
            })
            : Promise.resolve([]),
    ]);

    const traditionalActiveDaysByEnrollment = new Map<string, Set<string>>();
    for (const p of traditionalProgress) {
        const date = p.updatedAt.toISOString().slice(0, 10);
        const set = traditionalActiveDaysByEnrollment.get(p.enrollmentId) ?? new Set<string>();
        set.add(date);
        traditionalActiveDaysByEnrollment.set(p.enrollmentId, set);
    }

    const modulesByCourse = new Map<string, { id: string; publishedAt: Date }[]>();
    for (const m of bootcampModules) {
        const list = modulesByCourse.get(m.courseId) ?? [];
        list.push({ id: m.id, publishedAt: m.publishedAt as Date });
        modulesByCourse.set(m.courseId, list);
    }

    const firstWatchByEnrollment = new Map<string, Map<string, Date>>();
    for (const p of bootcampProgress) {
        const byModule = firstWatchByEnrollment.get(p.enrollmentId) ?? new Map<string, Date>();
        const existing = byModule.get(p.moduleId);
        if (!existing || p.updatedAt < existing) byModule.set(p.moduleId, p.updatedAt);
        firstWatchByEnrollment.set(p.enrollmentId, byModule);
    }

    const overdueCourseIds = new Set(overdueAssignmentCourses.map((row) => row.courseId));

    const enrollmentsWithStreak = enrollments.map((e) => {
        const { currentStreakDays, history } = e.course.courseType === CourseType.BOOTCAMP
            ? bootcampStreak(
                modulesByCourse.get(e.courseId) ?? [],
                firstWatchByEnrollment.get(e.id) ?? new Map(),
                overdueCourseIds.has(e.courseId),
            )
            : traditionalStreak(traditionalActiveDaysByEnrollment.get(e.id) ?? new Set());

        // Whether "Ticket" opens anything — the same rule as the ticket itself (AdmissionTicketService.getMyTicket).
        const { admissionTicket, ...course } = e.course;
        const hasAdmissionTicket =
            Boolean(admissionTicket?.isActive) && (e.status === EnrollmentStatus.ACTIVE || e.status === EnrollmentStatus.COMPLETED);

        return {
            ...e,
            course,
            hasAdmissionTicket,
            /** The main course this one came with as a reward, if that's how they have it. */
            rewardWith: rewardsWith.get(e.courseId) ?? null,
            streak: { currentStreakDays, courseType: e.course.courseType, history },
        };
    });

    const courseIds = enrollments.map((e) => e.courseId);

    // Most recently touched course — what "Continue Learning" should open.
    const continueLearning = enrollmentsWithStreak.find((e) => e.status === EnrollmentStatus.ACTIVE) ?? null;

    // Only look for the extras once the student actually has a course — these
    // queries are pointless (and `IN ()` is awkward) with an empty list.
    const [upcomingAssignments, upcomingSupport, upNext] = courseIds.length
        ? await Promise.all([
            prisma.assignment.findMany({
                where: {
                    courseId: { in: courseIds },
                    isPublished: true,
                    deadline: { gte: new Date() },
                    // Anything already handed in is no longer "upcoming".
                    submissions: { none: { studentId: user.userId } },
                },
                orderBy: { deadline: "asc" },
                take: 5,
                select: {
                    id: true, title: true, deadline: true, totalMarks: true,
                    course: { select: { id: true, title: true, slug: true } },
                },
            }),
            prisma.supportSession.findMany({
                where: {
                    courseId: { in: courseIds },
                    endTime: { gte: new Date() },
                    status: { in: [SupportSessionStatus.SCHEDULED, SupportSessionStatus.LIVE] },
                },
                orderBy: { startTime: "asc" },
                take: 5,
                select: {
                    id: true, title: true, startTime: true, endTime: true, status: true,
                    course: { select: { id: true, title: true, slug: true } },
                    mentor: { select: { id: true, name: true, image: true } },
                },
            }),
            continueLearning ? getUpNext(continueLearning.id, continueLearning.courseId) : null,
        ])
        : [[], [], null];

    return {
        summary: {
            enrolledCourses: enrollments.length,
            completedCourses: enrollments.filter((e) => e.status === EnrollmentStatus.COMPLETED).length,
            certificates,
            totalXp: xp._sum.totalXp ?? 0,
            unreadNotifications,
        },
        continueLearning: continueLearning && upNext ? { ...continueLearning, upNext } : continueLearning,
        enrollments: enrollmentsWithStreak,
        upcomingAssignments,
        upcomingSupport: upcomingSupport.map((session) => ({ ...session, isLive: computeLive(session) })),
    };
};

/** The staff dashboards' window: the last 30 days, set against the 30 before them. */
const PERIOD_DAYS = 30;

/** A day as the team in Bangladesh sees it, "YYYY-MM-DD". */
const dhakaDay = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" });
const dayKey = (date: Date) => dhakaDay.format(date);
/** The instant a Dhaka day begins — Dhaka is UTC+6 all year, with no daylight saving. */
const dhakaMidnight = (key: string) => new Date(`${key}T00:00:00+06:00`);
/** `count` Dhaka days ending today, oldest first. */
const dhakaDaysEndingToday = (now: Date, count: number) =>
    Array.from({ length: count }, (_, index) => dayKey(new Date(now.getTime() - (count - 1 - index) * DAY_MS)));

/** The mentor's agenda: today and the six days after it. */
const AGENDA_DAYS = 7;
const PENDING_REVIEW = [SubmissionStatus.SUBMITTED, SubmissionStatus.UNDER_REVIEW];

const median = (values: number[]) => {
    if (values.length === 0) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

/**
 * Mentor dashboard (plan §21), in the order a mentor works through it: the
 * support session they're running or about to run, the review queue (oldest
 * first), the week ahead — their sessions, the releases scheduled on their
 * bootcamp courses, the deadlines coming up — then each course's standing
 * and their own last 30 days against the 30 before (by Dhaka day). Students
 * appear by name only, and only on their hand-ins (lib/studentPrivacy).
 */
const getMentorDashboard = async (user: IRequestUser) => {
    const now = new Date();
    const assignments = await prisma.courseMentor.findMany({
        where: { mentorId: user.userId, course: { isDeleted: false } },
        orderBy: { order: "asc" },
        include: {
            course: {
                select: {
                    id: true, title: true, slug: true, thumbnail: true, status: true, courseType: true, phase: true,
                    milestoneLabel: true, moduleLabel: true,
                    _count: {
                        select: {
                            enrollments: true, milestones: true, modules: true, videos: true,
                        },
                    },
                },
            },
        },
    });

    const courseIds = assignments.map((a) => a.courseId);
    // Release dates exist only on bootcamp courses.
    const bootcampIds = assignments.filter((a) => a.course.courseType === CourseType.BOOTCAMP).map((a) => a.courseId);
    const inCourses = { courseId: { in: courseIds } };

    const weekStart = dhakaMidnight(dayKey(now));
    const weekEnd = new Date(weekStart.getTime() + AGENDA_DAYS * DAY_MS);
    const days = dhakaDaysEndingToday(now, PERIOD_DAYS * 2);
    const periodStart = dhakaMidnight(days[0]);

    // Their own sessions and their own work — these don't depend on which
    // courses they're assigned to today.
    const [upcomingSupport, agendaSessions, colleagueSessions, reviewEvents, reviewedRows, helpedRows, heldSessions] = await Promise.all([
        prisma.supportSession.findMany({
            where: {
                mentorId: user.userId,
                endTime: { gte: now },
                status: { in: [SupportSessionStatus.SCHEDULED, SupportSessionStatus.LIVE] },
            },
            orderBy: { startTime: "asc" },
            take: 50,
            include: {
                course: { select: { id: true, title: true, slug: true } },
                _count: { select: { queue: true } },
            },
        }),
        // The week's sessions: their own, and their co-mentors' on the courses they share.
        prisma.supportSession.findMany({
            where: {
                OR: [{ mentorId: user.userId }, inCourses],
                status: { not: SupportSessionStatus.CANCELLED },
                startTime: { gte: weekStart, lt: weekEnd },
            },
            orderBy: { startTime: "asc" },
            select: {
                id: true, title: true, startTime: true, endTime: true, status: true, meetingLink: true,
                course: { select: { id: true, title: true } },
                mentor: { select: { id: true, name: true } },
            },
        }),
        // Co-mentors' sessions still to come on the same courses — anyone on the course can run the board.
        prisma.supportSession.findMany({
            where: {
                ...inCourses,
                mentorId: { not: user.userId },
                endTime: { gte: now },
                status: { in: [SupportSessionStatus.SCHEDULED, SupportSessionStatus.LIVE] },
            },
            orderBy: { startTime: "asc" },
            take: 20,
            select: {
                id: true, title: true, startTime: true, endTime: true, status: true,
                course: { select: { id: true, title: true, slug: true } },
                mentor: { select: { id: true, name: true } },
            },
        }),
        // Every review they saved, from the staff activity log — a submission
        // row only remembers its latest review, and a resubmission clears it.
        prisma.staffActivity.findMany({
            where: { actorId: user.userId, action: "submission.review", createdAt: { gte: periodStart } },
            select: { createdAt: true },
        }),
        prisma.assignmentSubmission.findMany({
            where: { reviewedById: user.userId, reviewedAt: { gte: periodStart } },
            select: { submittedAt: true, reviewedAt: true },
        }),
        prisma.supportQueue.findMany({
            where: {
                session: { mentorId: user.userId },
                status: SupportQueueStatus.COMPLETED,
                completedAt: { gte: periodStart },
            },
            select: { completedAt: true },
        }),
        prisma.supportSession.findMany({
            where: {
                mentorId: user.userId,
                status: { not: SupportSessionStatus.CANCELLED },
                startTime: { gte: periodStart, lte: now },
            },
            select: { startTime: true },
        }),
    ]);

    // Where each session's line stands: waiting, with them, helped.
    const sessionIds = [...new Set([...upcomingSupport, ...agendaSessions, ...colleagueSessions].map((session) => session.id))];
    const queueGroups = sessionIds.length
        ? await prisma.supportQueue.groupBy({
            by: ["sessionId", "status"],
            where: { sessionId: { in: sessionIds } },
            _count: { _all: true },
        })
        : [];
    const queueOf = (sessionId: string) => {
        const count = (status: SupportQueueStatus) =>
            queueGroups.find((row) => row.sessionId === sessionId && row.status === status)?._count._all ?? 0;
        return {
            waiting: count(SupportQueueStatus.WAITING),
            serving: count(SupportQueueStatus.SERVING),
            done: count(SupportQueueStatus.COMPLETED),
        };
    };

    // A release on the agenda: scheduled from today on, or already out today.
    // A published item keeps its `releaseAt`, so one published by hand ahead
    // of it is left out rather than shown "out" at a time still to come.
    const releaseWhere = {
        courseId: { in: bootcampIds },
        releaseAt: { gte: weekStart },
        OR: [{ isPublished: false }, { releaseAt: { lte: now } }],
    };
    const releaseSelect = {
        id: true, title: true, courseId: true, releaseAt: true, isPublished: true,
        milestone: { select: { order: true } },
    } as const;

    const [
        enrolmentGroups,
        pending,
        waitingReviews,
        recentSubmissions,
        moduleReleases,
        assignmentReleases,
        practiceReleases,
        deadlines,
    ] = courseIds.length
        ? await Promise.all([
            prisma.enrollment.groupBy({
                by: ["courseId", "status"],
                where: { ...inCourses, status: { not: EnrollmentStatus.CANCELLED } },
                _count: { _all: true },
                _avg: { progress: true },
            }),
            prisma.assignmentSubmission.findMany({
                where: { assignment: inCourses, status: { in: PENDING_REVIEW } },
                select: { submittedAt: true, assignment: { select: { courseId: true } } },
            }),
            // Whoever has waited longest goes first — the review queue's own default.
            prisma.assignmentSubmission.findMany({
                where: { assignment: inCourses, status: { in: PENDING_REVIEW } },
                orderBy: { submittedAt: "asc" },
                take: 4,
                select: {
                    id: true, status: true, submittedAt: true, maxScore: true,
                    student: { select: STUDENT_NAME_ONLY },
                    assignment: {
                        select: { id: true, title: true, totalMarks: true, course: { select: { id: true, title: true } } },
                    },
                },
            }),
            prisma.assignmentSubmission.findMany({
                where: { assignment: inCourses },
                orderBy: { submittedAt: "desc" },
                take: 10,
                include: {
                    student: { select: STUDENT_NAME_ONLY },
                    assignment: {
                        select: {
                            id: true, title: true,
                            course: { select: { id: true, title: true } },
                        },
                    },
                },
            }),
            bootcampIds.length
                ? prisma.courseModule.findMany({
                    where: releaseWhere,
                    orderBy: { releaseAt: "asc" },
                    take: 200,
                    select: { ...releaseSelect, order: true },
                })
                : Promise.resolve([]),
            bootcampIds.length
                ? prisma.assignment.findMany({ where: releaseWhere, orderBy: { releaseAt: "asc" }, take: 200, select: releaseSelect })
                : Promise.resolve([]),
            bootcampIds.length
                ? prisma.practiceDay.findMany({ where: releaseWhere, orderBy: { releaseAt: "asc" }, take: 200, select: releaseSelect })
                : Promise.resolve([]),
            // Due this week — published, or scheduled to be by then.
            prisma.assignment.findMany({
                where: {
                    ...inCourses,
                    deadline: { gte: weekStart, lt: weekEnd },
                    OR: [{ isPublished: true }, { releaseAt: { not: null } }],
                },
                orderBy: { deadline: "asc" },
                select: {
                    id: true, title: true, deadline: true, courseId: true,
                    _count: { select: { submissions: true } },
                    // Just the ones still waiting on a review.
                    submissions: { where: { status: { in: PENDING_REVIEW } }, select: { id: true } },
                },
            }),
        ])
        : [[], [], [], [], [], [], [], []];

    const courseOf = new Map(assignments.map((a) => [a.courseId, a.course]));
    const releases = [
        ...moduleReleases.map((item) => ({ ...item, itemType: "MODULE" as const })),
        ...assignmentReleases.map((item) => ({ ...item, order: null, itemType: "ASSIGNMENT" as const })),
        ...practiceReleases.map((item) => ({ ...item, order: null, itemType: "PRACTICE" as const })),
    ].sort((a, b) => (a.releaseAt as Date).getTime() - (b.releaseAt as Date).getTime());

    const courseStats = (courseId: string) => {
        const groups = enrolmentGroups.filter((row) => row.courseId === courseId);
        const countOf = (status: EnrollmentStatus) => groups.find((row) => row.status === status)?._count._all ?? 0;
        const learning = groups.filter((row) => row.status === EnrollmentStatus.ACTIVE || row.status === EnrollmentStatus.COMPLETED);
        const learners = learning.reduce((sum, row) => sum + row._count._all, 0);
        const progressSum = learning.reduce((sum, row) => sum + (row._avg.progress ?? 0) * row._count._all, 0);
        const waiting = pending.filter((row) => row.assignment.courseId === courseId);
        const nextRelease = releases.find((item) => item.courseId === courseId && !item.isPublished && (item.releaseAt as Date) > now);

        return {
            students: groups.reduce((sum, row) => sum + row._count._all, 0),
            active: countOf(EnrollmentStatus.ACTIVE),
            completed: countOf(EnrollmentStatus.COMPLETED),
            averageProgress: learners > 0 ? Math.round(progressSum / learners) : 0,
            toReview: waiting.length,
            oldestWaitingAt: waiting.reduce<Date | null>((oldest, row) => (!oldest || row.submittedAt < oldest ? row.submittedAt : oldest), null),
            nextRelease: nextRelease
                ? {
                    itemType: nextRelease.itemType, title: nextRelease.title, at: nextRelease.releaseAt as Date,
                    milestoneOrder: nextRelease.milestone.order, order: nextRelease.order,
                }
                : null,
        };
    };
    const stats = new Map(courseIds.map((courseId) => [courseId, courseStats(courseId)]));
    const courseCard = (courseId: string) => {
        const course = courseOf.get(courseId);
        return { id: courseId, title: course?.title ?? "", milestoneLabel: course?.milestoneLabel ?? "Milestone", moduleLabel: course?.moduleLabel ?? "Module" };
    };

    const agenda = [
        ...agendaSessions.map(({ meetingLink, startTime, endTime, mentor, ...session }) => ({
            kind: "session" as const,
            ...session,
            // A co-mentor's session says whose it is; their own says nothing.
            host: mentor.id === user.userId ? null : mentor,
            at: startTime,
            endAt: endTime,
            isLive: computeLive({ startTime, endTime, status: session.status }),
            hasMeetingLink: Boolean(meetingLink),
            queue: queueOf(session.id),
        })),
        ...releases
            .filter((item) => (item.releaseAt as Date) < weekEnd)
            .map((item) => ({
                kind: "release" as const,
                id: item.id,
                itemType: item.itemType,
                title: item.title,
                at: item.releaseAt as Date,
                released: item.isPublished,
                milestoneOrder: item.milestone.order,
                order: item.order,
                course: courseCard(item.courseId),
            })),
        ...deadlines.map((assignment) => ({
            kind: "deadline" as const,
            id: assignment.id,
            title: assignment.title,
            at: assignment.deadline as Date,
            handedIn: assignment._count.submissions,
            toReview: assignment.submissions.length,
            // Everyone learning the course, finished or not.
            expected: (stats.get(assignment.courseId)?.active ?? 0) + (stats.get(assignment.courseId)?.completed ?? 0),
            course: courseCard(assignment.courseId),
        })),
    ].sort((a, b) => a.at.getTime() - b.at.getTime());

    // Their last 30 days against the 30 before, by Dhaka day.
    const previousDays = days.slice(0, PERIOD_DAYS);
    const currentDays = days.slice(PERIOD_DAYS);
    const byDay = (dates: (Date | null)[]) => {
        const counts = new Map<string, number>();
        for (const date of dates) {
            if (!date) continue;
            const key = dayKey(date);
            counts.set(key, (counts.get(key) ?? 0) + 1);
        }
        return counts;
    };
    const total = (counts: Map<string, number>, keys: string[]) => keys.reduce((sum, key) => sum + (counts.get(key) ?? 0), 0);
    const split = (counts: Map<string, number>) => ({ current: total(counts, currentDays), previous: total(counts, previousDays) });
    const reviewsByDay = byDay(reviewEvents.map((row) => row.createdAt));
    const helpedByDay = byDay(helpedRows.map((row) => row.completedAt));
    // Hours from hand-in to their review, for the reviews that still stand —
    // the median, so one submission left over a holiday doesn't speak for all.
    const turnaroundIn = (keys: string[]) => {
        const window = new Set(keys);
        return median(
            reviewedRows.flatMap(({ submittedAt, reviewedAt }) =>
                reviewedAt && reviewedAt >= submittedAt && window.has(dayKey(reviewedAt))
                    ? [(reviewedAt.getTime() - submittedAt.getTime()) / 3_600_000]
                    : [],
            ),
        );
    };

    return {
        summary: {
            assignedCourses: assignments.length,
            totalStudents: enrolmentGroups.reduce((sum, row) => sum + row._count._all, 0),
            pendingSubmissions: pending.length,
            upcomingSessions: upcomingSupport.length,
        },
        courses: assignments.map((a) => ({ role: a.role, ...a.course, stats: stats.get(a.courseId) })),
        upcomingSupport: upcomingSupport.map((session) => ({
            ...session,
            isLive: computeLive(session),
            queueStats: queueOf(session.id),
        })),
        colleagueSessions: colleagueSessions.map((session) => ({
            ...session,
            isLive: computeLive(session),
            queueStats: queueOf(session.id),
        })),
        waitingReviews,
        recentSubmissions,
        agenda: { from: weekStart, to: weekEnd, items: agenda },
        period: {
            reviews: split(reviewsByDay),
            helped: split(helpedByDay),
            sessions: split(byDay(heldSessions.map((row) => row.startTime))),
            turnaroundHours: { current: turnaroundIn(currentDays), previous: turnaroundIn(previousDays) },
        },
        trend: currentDays.map((date) => ({ date, reviews: reviewsByDay.get(date) ?? 0, helped: helpedByDay.get(date) ?? 0 })),
    };
};

/**
 * Admin dashboard (plan §35): what needs an admin now, what moved in the last
 * 30 days against the 30 before (by day, in Dhaka time), the latest activity,
 * how each course is doing, and the all-time totals.
 */
const getAdminDashboard = async () => {
    const now = new Date();
    // Sixty Dhaka days, oldest first: the previous period, then the current one
    // ending today. Rows are fetched from a day further back so the first day
    // is never cut short; anything outside these days isn't counted.
    const days = Array.from({ length: PERIOD_DAYS * 2 }, (_, index) =>
        dayKey(new Date(now.getTime() - (PERIOD_DAYS * 2 - 1 - index) * DAY_MS)),
    );
    const since = new Date(now.getTime() - (PERIOD_DAYS * 2 + 1) * DAY_MS);

    const [
        totalStudents,
        totalMentors,
        totalCourses,
        publishedCourses,
        totalEnrollments,
        completedEnrollments,
        certificates,
        revenue,
        pendingOrders,
        activeSupport,
        waitingStudents,
        recentUsers,
        recentOrders,
        recentEnrollments,
        publishedCourseList,
        enrollmentsByCourse,
        revenueByCourse,
        periodPayments,
        periodEnrollments,
        periodLearners,
        periodCompletions,
    ] = await Promise.all([
        prisma.user.count({ where: learnerScope(Role.STUDENT) }),
        prisma.user.count({ where: learnerScope(Role.MENTOR) }),
        prisma.course.count({ where: { isDeleted: false } }),
        prisma.course.count({ where: { isDeleted: false, status: CourseStatus.PUBLISHED } }),
        // A cancelled enrolment was never really one.
        prisma.enrollment.count({ where: { status: { not: EnrollmentStatus.CANCELLED } } }),
        prisma.enrollment.count({ where: { status: EnrollmentStatus.COMPLETED } }),
        prisma.certificate.count({ where: { status: CertificateStatus.ISSUED } }),
        // Revenue counts settled orders only — pending ones are not money.
        prisma.order.aggregate({ where: { status: OrderStatus.PAID }, _sum: { total: true } }),
        // Every one of them, not just those among the latest few.
        prisma.order.aggregate({ where: { status: OrderStatus.PENDING }, _count: { _all: true }, _sum: { total: true } }),
        prisma.supportSession.count({ where: { status: SupportSessionStatus.LIVE } }),
        prisma.supportQueue.count({ where: { status: "WAITING" } }),
        // "Recent users" = the newest people to arrive on Half Coders, which is
        // when their learning profile was created.
        prisma.learningProfile.findMany({
            where: { status: LearningStatus.ACTIVE, user: { isDeleted: false } },
            orderBy: { createdAt: "desc" },
            take: 8,
            select: {
                createdAt: true,
                user: { select: { id: true, name: true, email: true, image: true, role: true } },
            },
        }),
        prisma.order.findMany({
            orderBy: { createdAt: "desc" },
            take: 8,
            include: {
                student: { select: { id: true, name: true, email: true } },
                course: { select: { id: true, title: true } },
            },
        }),
        prisma.enrollment.findMany({
            orderBy: { createdAt: "desc" },
            take: 8,
            include: {
                student: { select: { id: true, name: true, image: true } },
                course: { select: { id: true, title: true, slug: true } },
            },
        }),
        prisma.course.findMany({
            where: { isDeleted: false, status: CourseStatus.PUBLISHED },
            select: { id: true, title: true, slug: true, thumbnail: true, price: true, discountPrice: true, courseType: true },
        }),
        prisma.enrollment.groupBy({ by: ["courseId", "status"], _count: { _all: true } }),
        prisma.order.groupBy({ by: ["courseId"], where: { status: OrderStatus.PAID }, _sum: { total: true } }),
        prisma.payment.findMany({
            where: { status: OrderStatus.PAID, paidAt: { gte: since } },
            select: { amount: true, paidAt: true },
        }),
        prisma.enrollment.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } }),
        prisma.learningProfile.findMany({
            where: { createdAt: { gte: since }, user: learnerScope(Role.STUDENT) },
            select: { createdAt: true },
        }),
        prisma.enrollment.findMany({ where: { completedAt: { gte: since } }, select: { completedAt: true } }),
    ]);

    // Day by day, then the two periods.
    const sumByDay = <T>(rows: T[], dateOf: (row: T) => Date | null, valueOf: (row: T) => number = () => 1) => {
        const byDay = new Map<string, number>();
        for (const row of rows) {
            const date = dateOf(row);
            if (!date) continue;
            const key = dayKey(date);
            byDay.set(key, (byDay.get(key) ?? 0) + valueOf(row));
        }
        return byDay;
    };
    const series = {
        revenue: sumByDay(periodPayments, (row) => row.paidAt, (row) => row.amount),
        enrolments: sumByDay(periodEnrollments, (row) => row.createdAt),
        learners: sumByDay(periodLearners, (row) => row.createdAt),
        completions: sumByDay(periodCompletions, (row) => row.completedAt),
    };
    const previousDays = days.slice(0, PERIOD_DAYS);
    const currentDays = days.slice(PERIOD_DAYS);
    const total = (byDay: Map<string, number>, keys: string[]) => keys.reduce((sum, key) => sum + (byDay.get(key) ?? 0), 0);
    const period = Object.fromEntries(
        Object.entries(series).map(([name, byDay]) => [
            name,
            { current: total(byDay, currentDays), previous: total(byDay, previousDays) },
        ]),
    ) as Record<keyof typeof series, { current: number; previous: number }>;

    // Courses by the students who still have access, with what they've earned.
    const counts = new Map<string, { enrolled: number; completed: number }>();
    for (const row of enrollmentsByCourse) {
        const entry = counts.get(row.courseId) ?? { enrolled: 0, completed: 0 };
        if (row.status === EnrollmentStatus.ACTIVE || row.status === EnrollmentStatus.COMPLETED) entry.enrolled += row._count._all;
        if (row.status === EnrollmentStatus.COMPLETED) entry.completed += row._count._all;
        counts.set(row.courseId, entry);
    }
    const earned = new Map(revenueByCourse.map((row) => [row.courseId, row._sum.total ?? 0]));
    const topCourses = publishedCourseList
        .map((course) => ({
            course,
            enrolled: counts.get(course.id)?.enrolled ?? 0,
            completed: counts.get(course.id)?.completed ?? 0,
            revenue: earned.get(course.id) ?? 0,
        }))
        .sort((a, b) => b.enrolled - a.enrolled || b.revenue - a.revenue || a.course.title.localeCompare(b.course.title))
        .slice(0, 5);

    return {
        summary: {
            totalStudents,
            totalMentors,
            totalCourses,
            publishedCourses,
            totalEnrollments,
            completedEnrollments,
            certificates,
            totalRevenue: revenue._sum.total ?? 0,
            activeSupportSessions: activeSupport,
            waitingStudents,
        },
        pendingOrders: { count: pendingOrders._count._all, total: pendingOrders._sum.total ?? 0 },
        trend: currentDays.map((date) => ({
            date,
            revenue: series.revenue.get(date) ?? 0,
            enrolments: series.enrolments.get(date) ?? 0,
            learners: series.learners.get(date) ?? 0,
            completions: series.completions.get(date) ?? 0,
        })),
        period,
        recentUsers: recentUsers.map(({ user: { role, ...user }, createdAt }) => ({
            ...user,
            role,
            createdAt,
        })),
        recentOrders,
        recentEnrollments,
        topCourses,
    };
};

export const DashboardService = {
    getStudentDashboard,
    getMentorDashboard,
    getAdminDashboard,
};
