import { QuizAttemptStatus, SignInOutcome } from "../../../generated/prisma/enums";
import { IpPlace, placesOf } from "../../lib/ipLocation";
import { prisma } from "../../lib/prisma";
import { describeUserAgent } from "../../lib/userAgent";
import { finalScore } from "../../utils/assignmentPenalties";
import { assertStudent } from "./studentScope";

/**
 * Everything a student did, newest first, as one feed — for the admin's
 * student activity page, and the few latest on the student page's overview:
 * lessons finished, work handed in and marked, quizzes, practice days, support
 * visits, enrolments, certificates, payments, and each sign-in (with the
 * device, address and place) — the ones the device limit refused too.
 *
 * Paged by a cursor (`before`: the last entry's time and id), since the feed
 * is merged from a dozen tables: each page takes the next few from every one
 * of them and keeps the newest.
 */

export const ACTIVITY_KINDS = [
    "lesson",
    "submission",
    "review",
    "quiz",
    "practice",
    "support",
    "enrolled",
    "certificate",
    "payment",
    "signin",
    "refused",
] as const;
export type ActivityKind = (typeof ACTIVITY_KINDS)[number];

/** Kinds that belong to no course — left out when the feed is filtered to one. */
const ACCOUNT_KINDS: ActivityKind[] = ["signin", "refused"];

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const DAY_MS = 24 * 60 * 60 * 1000;
/** The activity calendar: 26 weeks. */
const CALENDAR_DAYS = 26 * 7;

/** A day as students and mentors in Bangladesh see it. */
const dhakaDay = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" });
const dayKey = (date: Date) => dhakaDay.format(date);

const weekLabel = (label: string, order: number) => `${label} ${String(order).padStart(2, "0")}`;

const courseSelect = { select: { id: true, title: true, milestoneLabel: true, moduleLabel: true } } as const;
type CourseRow = { id: string; title: string; milestoneLabel: string; moduleLabel: string };
const courseRef = (course: CourseRow) => ({ id: course.id, title: course.title });

export interface ActivityEntry {
    /** Unique across the feed: the kind, then the row's id. */
    id: string;
    kind: ActivityKind;
    at: Date;
    title: string;
    course: { id: string; title: string } | null;
    /** Where in the course: "Week 03 · Module 2". */
    where?: string | null;
    /** A line more: the module's name, the topic asked about, a note, a certificate number. */
    detail?: string | null;
    status?: string | null;
    /** Marks or a quiz score: "8 / 10" and its percentage. */
    score?: { label: string; percent: number | null } | null;
    /** Taka, for a payment. */
    amount?: number;
    by?: { id: string; name: string; image: string | null } | null;
    /** A finished quiz — opens its answers. */
    quizAttemptId?: string;
    /** A sign-in: the device, address and place. */
    device?: {
        browser: string | null;
        os: string | null;
        deviceType: string;
        ipAddress: string | null;
        place: IpPlace | null;
    };
    method?: string | null;
    /** How many of their devices a sign-in signed out to make room. */
    signedOutOthers?: number;
}

type Cursor = { at: Date; id: string };

/** `before` is "<ISO time>|<entry id>", as `nextCursor` gives it. */
const parseCursor = (value: unknown): Cursor | null => {
    if (typeof value !== "string" || !value.includes("|")) return null;
    const [iso, ...rest] = value.split("|");
    const at = new Date(iso);
    return Number.isNaN(at.getTime()) ? null : { at, id: rest.join("|") };
};

const parseKinds = (value: unknown): ActivityKind[] => {
    const raw = typeof value === "string" ? value.split(",") : Array.isArray(value) ? value.map(String) : [];
    const kinds = raw.map((kind) => kind.trim()).filter((kind): kind is ActivityKind => (ACTIVITY_KINDS as readonly string[]).includes(kind));
    return kinds.length > 0 ? kinds : [...ACTIVITY_KINDS];
};

/** Newest first; entries at the very same moment by id, so paging never skips or repeats one. */
const newestFirst = (a: ActivityEntry, b: ActivityEntry) => b.at.getTime() - a.at.getTime() || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0);

const isBefore = (entry: ActivityEntry, cursor: Cursor) =>
    entry.at.getTime() < cursor.at.getTime() || (entry.at.getTime() === cursor.at.getTime() && entry.id < cursor.id);

/**
 * One page of the feed. No student check: `getStudentActivity` makes it, and
 * the overview (which reads the first few) has made it already.
 */
export const activityPage = async (
    userId: string,
    options: { limit?: number; before?: Cursor | null; kinds?: ActivityKind[]; courseId?: string | null } = {},
) => {
    const limit = Math.min(MAX_LIMIT, Math.max(1, options.limit ?? DEFAULT_LIMIT));
    const courseId = options.courseId || null;
    const kinds = new Set((options.kinds ?? [...ACTIVITY_KINDS]).filter((kind) => !(courseId && ACCOUNT_KINDS.includes(kind))));
    const upTo = options.before ? { lte: options.before.at } : undefined;
    // One more than a page from each table: enough for the newest `limit` overall, and to know there's more.
    const take = limit + 1;
    const want = (kind: ActivityKind) => kinds.has(kind);
    const none = Promise.resolve([] as never[]);

    const [lessons, submissions, reviews, quizzes, practice, support, enrolments, certificates, payments, signIns] = await Promise.all([
        want("lesson")
            ? prisma.videoProgress.findMany({
                  where: {
                      studentId: userId,
                      isCompleted: true,
                      completedAt: { not: null, ...upTo },
                      ...(courseId && { video: { courseId } }),
                  },
                  orderBy: { completedAt: "desc" },
                  take,
                  select: {
                      id: true,
                      completedAt: true,
                      video: {
                          select: {
                              title: true,
                              course: courseSelect,
                              module: { select: { title: true, order: true, milestone: { select: { order: true } } } },
                          },
                      },
                  },
              })
            : none,
        want("submission")
            ? prisma.assignmentSubmission.findMany({
                  where: { studentId: userId, ...(upTo && { submittedAt: upTo }), ...(courseId && { assignment: { courseId } }) },
                  orderBy: { submittedAt: "desc" },
                  take,
                  select: {
                      id: true,
                      submittedAt: true,
                      attempts: true,
                      status: true,
                      assignment: { select: { title: true, deadline: true, course: courseSelect, milestone: { select: { order: true } } } },
                  },
              })
            : none,
        want("review")
            ? prisma.assignmentSubmission.findMany({
                  where: { studentId: userId, reviewedAt: { not: null, ...upTo }, ...(courseId && { assignment: { courseId } }) },
                  orderBy: { reviewedAt: "desc" },
                  take,
                  select: {
                      id: true,
                      reviewedAt: true,
                      status: true,
                      score: true,
                      maxScore: true,
                      markAdjustment: true,
                      reviewedBy: { select: { id: true, name: true, image: true } },
                      assignment: { select: { title: true, totalMarks: true, course: courseSelect, milestone: { select: { order: true } } } },
                  },
              })
            : none,
        want("quiz")
            ? prisma.quizAttempt.findMany({
                  where: {
                      studentId: userId,
                      status: QuizAttemptStatus.COMPLETED,
                      completedAt: { not: null, ...upTo },
                      ...(courseId && { quiz: { courseId } }),
                  },
                  orderBy: { completedAt: "desc" },
                  take,
                  select: {
                      id: true,
                      completedAt: true,
                      percentage: true,
                      correctCount: true,
                      totalQuestions: true,
                      quiz: {
                          select: {
                              title: true,
                              course: courseSelect,
                              module: { select: { order: true, milestone: { select: { order: true } } } },
                              assignment: { select: { title: true, milestone: { select: { order: true } } } },
                          },
                      },
                  },
              })
            : none,
        want("practice")
            ? prisma.practiceCompletion.findMany({
                  where: { studentId: userId, ...(upTo && { completedAt: upTo }), ...(courseId && { practiceDay: { courseId } }) },
                  orderBy: { completedAt: "desc" },
                  take,
                  select: {
                      id: true,
                      completedAt: true,
                      note: true,
                      practiceDay: { select: { title: true, course: courseSelect, milestone: { select: { order: true } } } },
                  },
              })
            : none,
        want("support")
            ? prisma.supportQueue.findMany({
                  where: { studentId: userId, ...(upTo && { joinedAt: upTo }), ...(courseId && { session: { courseId } }) },
                  orderBy: { joinedAt: "desc" },
                  take,
                  select: {
                      id: true,
                      joinedAt: true,
                      status: true,
                      topic: true,
                      session: {
                          select: { title: true, course: courseSelect, mentor: { select: { id: true, name: true, image: true } } },
                      },
                  },
              })
            : none,
        want("enrolled")
            ? prisma.enrollment.findMany({
                  where: { studentId: userId, ...(upTo && { createdAt: upTo }), ...(courseId && { courseId }) },
                  orderBy: { createdAt: "desc" },
                  take,
                  select: { id: true, createdAt: true, course: courseSelect, order: { select: { orderNumber: true } } },
              })
            : none,
        want("certificate")
            ? prisma.certificate.findMany({
                  where: { studentId: userId, ...(upTo && { issuedAt: upTo }), ...(courseId && { courseId }) },
                  orderBy: { issuedAt: "desc" },
                  take,
                  select: { id: true, issuedAt: true, certificateNo: true, status: true, course: courseSelect },
              })
            : none,
        want("payment")
            ? prisma.payment.findMany({
                  where: { paidAt: { not: null, ...upTo }, order: { studentId: userId, ...(courseId && { courseId }) } },
                  orderBy: { paidAt: "desc" },
                  take,
                  select: {
                      id: true,
                      paidAt: true,
                      gateway: true,
                      order: { select: { orderNumber: true, total: true, course: courseSelect } },
                  },
              })
            : none,
        want("signin") || want("refused")
            ? prisma.signInEvent.findMany({
                  where: {
                      userId,
                      ...(upTo && { createdAt: upTo }),
                      outcome: {
                          in: [...(want("signin") ? [SignInOutcome.SIGNED_IN] : []), ...(want("refused") ? [SignInOutcome.DEVICE_LIMIT_REFUSED] : [])],
                      },
                  },
                  orderBy: { createdAt: "desc" },
                  take,
                  select: { id: true, createdAt: true, outcome: true, method: true, ipAddress: true, userAgent: true, signedOutOthers: true },
              })
            : none,
    ]);

    const places = await placesOf(signIns.map((row) => row.ipAddress));
    const percentOf = (score: number | null, outOf: number) => (score === null || outOf <= 0 ? null : Math.round((score / outOf) * 100));

    const entries: ActivityEntry[] = [
        ...lessons.map((row) => {
            const { course, module } = row.video;
            return {
                id: `lesson-${row.id}`,
                kind: "lesson" as const,
                at: row.completedAt as Date,
                title: row.video.title,
                course: courseRef(course),
                where: `${weekLabel(course.milestoneLabel, module.milestone.order)} · ${course.moduleLabel} ${module.order}`,
                detail: module.title,
            };
        }),
        ...submissions.map((row) => ({
            id: `submission-${row.id}`,
            kind: "submission" as const,
            at: row.submittedAt,
            title: row.assignment.title,
            course: courseRef(row.assignment.course),
            where: weekLabel(row.assignment.course.milestoneLabel, row.assignment.milestone.order),
            detail:
                [
                    row.attempts > 1 ? `Handed in ${row.attempts} times` : null,
                    row.assignment.deadline && row.submittedAt > row.assignment.deadline ? "After the deadline" : null,
                ]
                    .filter(Boolean)
                    .join(" · ") || null,
            status: row.status,
        })),
        ...reviews.map((row) => {
            const outOf = row.maxScore ?? row.assignment.totalMarks;
            const final = finalScore(row.score, row.markAdjustment);
            return {
                id: `review-${row.id}`,
                kind: "review" as const,
                at: row.reviewedAt as Date,
                title: row.assignment.title,
                course: courseRef(row.assignment.course),
                where: weekLabel(row.assignment.course.milestoneLabel, row.assignment.milestone.order),
                status: row.status,
                score: final === null ? null : { label: `${final} / ${outOf}`, percent: percentOf(final, outOf) },
                by: row.reviewedBy,
            };
        }),
        ...quizzes.map((row) => {
            const { course, module, assignment } = row.quiz;
            const week = (module ?? assignment)?.milestone.order;
            return {
                id: `quiz-${row.id}`,
                kind: "quiz" as const,
                at: row.completedAt as Date,
                title: row.quiz.title,
                course: courseRef(course),
                where: [
                    week !== undefined ? weekLabel(course.milestoneLabel, week) : null,
                    module ? `${course.moduleLabel} ${module.order}` : assignment ? assignment.title : null,
                ]
                    .filter(Boolean)
                    .join(" · "),
                score: { label: `${row.correctCount}/${row.totalQuestions} right`, percent: row.percentage },
                quizAttemptId: row.id,
            };
        }),
        ...practice.map((row) => ({
            id: `practice-${row.id}`,
            kind: "practice" as const,
            at: row.completedAt,
            title: row.practiceDay.title,
            course: courseRef(row.practiceDay.course),
            where: weekLabel(row.practiceDay.course.milestoneLabel, row.practiceDay.milestone.order),
            detail: row.note,
        })),
        ...support.map((row) => ({
            id: `support-${row.id}`,
            kind: "support" as const,
            at: row.joinedAt,
            title: row.session.title || "Support session",
            course: courseRef(row.session.course),
            detail: row.topic,
            status: row.status,
            by: row.session.mentor,
        })),
        ...enrolments.map((row) => ({
            id: `enrolled-${row.id}`,
            kind: "enrolled" as const,
            at: row.createdAt,
            title: row.course.title,
            course: courseRef(row.course),
            detail: row.order ? `Order ${row.order.orderNumber}` : "Added without an order",
        })),
        ...certificates.map((row) => ({
            id: `certificate-${row.id}`,
            kind: "certificate" as const,
            at: row.issuedAt,
            title: row.course.title,
            course: courseRef(row.course),
            detail: row.certificateNo,
            status: row.status,
        })),
        ...payments.map((row) => ({
            id: `payment-${row.id}`,
            kind: "payment" as const,
            at: row.paidAt as Date,
            title: row.order.course.title,
            course: courseRef(row.order.course),
            detail: `Order ${row.order.orderNumber}`,
            status: row.gateway,
            amount: row.order.total,
        })),
        ...signIns.map((row) => {
            const device = describeUserAgent(row.userAgent);
            const refused = row.outcome === SignInOutcome.DEVICE_LIMIT_REFUSED;
            return {
                id: `${refused ? "refused" : "signin"}-${row.id}`,
                kind: refused ? ("refused" as const) : ("signin" as const),
                at: row.createdAt,
                title: device.browser && device.os ? `${device.browser} on ${device.os}` : (device.browser ?? device.os ?? "Unknown device"),
                course: null,
                device: { ...device, ipAddress: row.ipAddress, place: row.ipAddress ? (places.get(row.ipAddress) ?? null) : null },
                method: row.method,
                signedOutOthers: row.signedOutOthers,
            };
        }),
    ];

    const cursor = options.before ?? null;
    const sorted = entries.filter((entry) => !cursor || isBefore(entry, cursor)).sort(newestFirst);
    const data = sorted.slice(0, limit);
    const last = data[data.length - 1];

    return {
        data,
        /** Pass as `before` for the next page; null once there's no more. */
        nextCursor: sorted.length > limit && last ? `${last.at.toISOString()}|${last.id}` : null,
    };
};

/** A page of the feed: `before` (a cursor), `limit`, `kinds` (comma-separated) and `courseId`. */
const getStudentActivity = async (userId: string, query: { before?: unknown; limit?: unknown; kinds?: unknown; courseId?: unknown }) => {
    await assertStudent(userId);
    return activityPage(userId, {
        before: parseCursor(query.before),
        limit: Number(query.limit) || DEFAULT_LIMIT,
        kinds: parseKinds(query.kinds),
        courseId: typeof query.courseId === "string" ? query.courseId : null,
    });
};

/**
 * The top of the activity page: how much of each kind there is, the courses
 * to filter by, and a calendar of the last 26 weeks — how many lessons,
 * submissions, quizzes and practice days each day, with the days in a row.
 */
const getStudentActivitySummary = async (userId: string) => {
    await assertStudent(userId);

    const now = new Date();
    const since = new Date(now.getTime() - CALENDAR_DAYS * DAY_MS);
    const mine = { studentId: userId };

    const [lessons, submissions, quizzes, practice, enrolments, counts] = await Promise.all([
        prisma.videoProgress.findMany({ where: { ...mine, isCompleted: true, completedAt: { gte: since } }, select: { completedAt: true } }),
        prisma.assignmentSubmission.findMany({ where: { ...mine, submittedAt: { gte: since } }, select: { submittedAt: true } }),
        prisma.quizAttempt.findMany({
            where: { ...mine, status: QuizAttemptStatus.COMPLETED, completedAt: { gte: since } },
            select: { completedAt: true },
        }),
        prisma.practiceCompletion.findMany({ where: { ...mine, completedAt: { gte: since } }, select: { completedAt: true } }),
        prisma.enrollment.findMany({ where: mine, orderBy: { createdAt: "desc" }, select: { course: { select: { id: true, title: true } } } }),
        Promise.all([
            prisma.videoProgress.count({ where: { ...mine, isCompleted: true, completedAt: { not: null } } }),
            prisma.assignmentSubmission.count({ where: mine }),
            prisma.assignmentSubmission.count({ where: { ...mine, reviewedAt: { not: null } } }),
            prisma.quizAttempt.count({ where: { ...mine, status: QuizAttemptStatus.COMPLETED } }),
            prisma.practiceCompletion.count({ where: mine }),
            prisma.supportQueue.count({ where: mine }),
            prisma.enrollment.count({ where: mine }),
            prisma.certificate.count({ where: mine }),
            prisma.payment.count({ where: { paidAt: { not: null }, order: mine } }),
            prisma.signInEvent.count({ where: { userId, outcome: SignInOutcome.SIGNED_IN } }),
            prisma.signInEvent.count({ where: { userId, outcome: SignInOutcome.DEVICE_LIMIT_REFUSED } }),
        ]),
    ]);

    const days = Array.from({ length: CALENDAR_DAYS }, (_, index) => dayKey(new Date(now.getTime() - (CALENDAR_DAYS - 1 - index) * DAY_MS)));
    const blank = () => ({ lessons: 0, submissions: 0, quizzes: 0, practice: 0 });
    const byDay = new Map(days.map((date) => [date, blank()]));
    const tally = (dates: (Date | null)[], field: keyof ReturnType<typeof blank>) => {
        for (const date of dates) {
            const day = date && byDay.get(dayKey(date));
            if (day) day[field] += 1;
        }
    };
    tally(
        lessons.map((row) => row.completedAt),
        "lessons",
    );
    tally(
        submissions.map((row) => row.submittedAt),
        "submissions",
    );
    tally(
        quizzes.map((row) => row.completedAt),
        "quizzes",
    );
    tally(
        practice.map((row) => row.completedAt),
        "practice",
    );

    const calendar = days.map((date) => {
        const day = byDay.get(date) ?? blank();
        return { date, ...day, total: day.lessons + day.submissions + day.quizzes + day.practice };
    });

    // Days in a row: the current run (today, or up to yesterday if today's still empty) and the longest in the calendar.
    let longest = 0;
    let run = 0;
    for (const day of calendar) {
        run = day.total > 0 ? run + 1 : 0;
        longest = Math.max(longest, run);
    }
    let current = 0;
    for (let index = calendar.length - 1; index >= 0; index -= 1) {
        if (calendar[index].total > 0) current += 1;
        else if (index === calendar.length - 1) continue;
        else break;
    }

    const [lesson, submission, review, quiz, practiceDays, supportVisits, enrolled, certificate, payment, signin, refused] = counts;
    return {
        counts: {
            lesson,
            submission,
            review,
            quiz,
            practice: practiceDays,
            support: supportVisits,
            enrolled,
            certificate,
            payment,
            signin,
            refused,
        } satisfies Record<ActivityKind, number>,
        courses: enrolments.map((row) => row.course),
        calendar,
        activeDays: {
            last30: calendar.slice(-30).filter((day) => day.total > 0).length,
            inCalendar: calendar.filter((day) => day.total > 0).length,
        },
        streak: { current, longest },
    };
};

export const StudentActivityService = {
    getStudentActivity,
    getStudentActivitySummary,
};
