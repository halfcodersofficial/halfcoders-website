import status from "http-status";
import { Prisma } from "../../../generated/prisma/client";
import {
    CoursePhase,
    NotificationType,
    SupportQueueStatus,
    SupportSessionStatus,
    XpSource,
} from "../../../generated/prisma/enums";
import { Role } from "../../lib/roles";
import AppError from "../../errorHelpers/AppError";
import { IRequestUser } from "../../interfaces/requestUser.interface";
import { prisma } from "../../lib/prisma";
import { STUDENT_NAME_ONLY, studentSelectFor } from "../../lib/studentPrivacy";
import { emitQueueUpdate, emitSessionStatus } from "../../lib/realtime";
import { adminCourseSelect, AdminCourseCard } from "../../utils/adminCourseSelect";
import { assertCanManageCourse, requireCourseAccess, requireEnrollment } from "../../utils/courseAccess";
import { assertSupportOpen } from "../../utils/coursePhase";
import { logger } from "../../utils/logger";
import { getSupportSlotMinutes } from "../../utils/platformSettings";
import { awardXp } from "../leaderboard/leaderboard.service";
import { createNotification, createNotificationsFor } from "../notification/notification.service";
import { dhakaClock, dhakaWhen } from "../../utils/dhakaTime";

const studentCard = { id: true, name: true, image: true } as const;

/** Tells everyone who can still open the course about one of its sessions — one bulk write, never throws. */
const notifyEnrolled = async (
    course: { id: string; slug: string },
    input: { title: string; message: string; senderId?: string },
) => {
    const enrollments = await prisma.enrollment.findMany({
        where: { courseId: course.id, status: { not: "CANCELLED" } },
        select: { studentId: true },
    });
    return createNotificationsFor(
        enrollments.map((enrollment) => enrollment.studentId),
        // Scheduled, moved, called off: worth an email — they may plan their day around it.
        { ...input, type: NotificationType.SUPPORT, link: `/learn/${course.slug}/support`, email: { actionLabel: "Open support" } },
    );
};

/**
 * Whether the session is open for students right now (plan §23).
 *
 * Derived from the clock rather than from a flag a mentor has to remember to
 * flip: before the start time students see "not started yet", inside the
 * window they see Join. An explicit CANCELLED or ENDED status still wins, so a
 * mentor can close a session early.
 */
export const computeLive = (session: {
    startTime: Date;
    endTime: Date;
    status: SupportSessionStatus;
}): boolean => {
    if (session.status === SupportSessionStatus.CANCELLED) return false;
    if (session.status === SupportSessionStatus.ENDED) return false;

    const now = Date.now();
    return now >= session.startTime.getTime() && now <= session.endTime.getTime();
};

// ---------------------------------------------------------------------------
// Session management (mentor + admin)
// ---------------------------------------------------------------------------

/**
 * Who ends up hosting the session. A mentor can only ever host their own —
 * letting them name someone else would let one mentor impersonate another as
 * the "who's running this" card students see. An admin may schedule on a
 * mentor's behalf via `mentorId`, checked against that course's assigned
 * mentors; omitting it keeps today's default of the admin themself.
 */
const resolveHostMentorId = async (
    user: IRequestUser,
    courseId: string,
    requestedMentorId: string | undefined,
) => {
    if (user.role === Role.MENTOR || !requestedMentorId) return user.userId;

    const assignment = await prisma.courseMentor.findUnique({
        where: { courseId_mentorId: { courseId, mentorId: requestedMentorId } },
    });
    if (!assignment) {
        throw new AppError(status.BAD_REQUEST, "That mentor isn't assigned to this course.");
    }
    return requestedMentorId;
};

const createSession = async (
    user: IRequestUser,
    payload: {
        courseId: string;
        title?: string;
        meetingLink?: string;
        startTime: Date;
        endTime: Date;
        slotMinutes?: number;
        notes?: string;
        mentorId?: string;
    },
) => {
    await assertCanManageCourse(user, payload.courseId);
    await assertSupportOpen(payload.courseId);

    const mentorId = await resolveHostMentorId(user, payload.courseId, payload.mentorId);
    const slotMinutes = payload.slotMinutes ?? (await getSupportSlotMinutes());
    const { mentorId: _requestedMentorId, ...rest } = payload;

    logger.create("Creating support session", { courseId: payload.courseId });

    const session = await prisma.supportSession.create({
        data: { ...rest, mentorId, slotMinutes },
        include: {
            course: { select: { id: true, title: true, slug: true } },
            mentor: { select: studentCard },
        },
    });

    await notifyEnrolled(session.course, {
        title: "Support session scheduled",
        message: `A support session for ${session.course.title} is scheduled for ${dhakaWhen(session.startTime)}.`,
        senderId: user.userId,
    });

    return { ...session, isLive: computeLive(session) };
};

const updateSession = async (
    user: IRequestUser,
    sessionId: string,
    payload: Record<string, unknown>,
) => {
    const session = await prisma.supportSession.findUnique({
        where: { id: sessionId },
        select: { courseId: true, startTime: true, endTime: true, status: true },
    });
    if (!session) throw new AppError(status.NOT_FOUND, "Support session not found.");

    await assertCanManageCourse(user, session.courseId);
    await assertSupportOpen(session.courseId);

    // A PATCH that moves only one edge could otherwise invert the window.
    const nextStart = (payload.startTime as Date | undefined) ?? session.startTime;
    const nextEnd = (payload.endTime as Date | undefined) ?? session.endTime;
    if (nextEnd <= nextStart) {
        throw new AppError(status.BAD_REQUEST, "The session must end after it starts.");
    }

    if (payload.mentorId !== undefined) {
        payload.mentorId = await resolveHostMentorId(
            user,
            session.courseId,
            payload.mentorId as string,
        );
    }

    // Moving the start time means the "live now" moment hasn't happened yet
    // under the new schedule, however it happened under the old one — clear
    // the guard so `notifyLiveSessions` fires again at the new time.
    if (payload.startTime !== undefined && nextStart.getTime() !== session.startTime.getTime()) {
        payload.liveNotifiedAt = null;
    }

    const updated = await prisma.supportSession.update({
        where: { id: sessionId },
        data: payload,
        include: {
            course: { select: { id: true, title: true, slug: true } },
            mentor: { select: studentCard },
        },
    });

    emitSessionStatus(sessionId, { sessionId, isLive: computeLive(updated), status: updated.status });
    // Covers the join-cutoff toggle along with any other edit, so a student
    // already watching this session's board sees it without a refresh.
    await broadcastQueue(sessionId);

    // They were told the old time; a session still to come that moves gets a fresh word.
    const moved = nextStart.getTime() !== session.startTime.getTime();
    const stillOn = session.status === SupportSessionStatus.SCHEDULED || session.status === SupportSessionStatus.LIVE;
    if (moved && stillOn && nextStart.getTime() > Date.now()) {
        await notifyEnrolled(updated.course, {
            title: "Support session moved",
            message: `${updated.course.title}'s support session is now ${dhakaWhen(nextStart)} – ${dhakaClock(nextEnd)}.`,
            senderId: user.userId,
        });
    }

    return { ...updated, isLive: computeLive(updated) };
};

/** Explicit open/close, for a mentor starting early or wrapping up late. */
const setSessionStatus = async (
    user: IRequestUser,
    sessionId: string,
    nextStatus: SupportSessionStatus,
) => {
    const session = await prisma.supportSession.findUnique({
        where: { id: sessionId },
        select: { courseId: true, status: true, startTime: true, endTime: true, course: { select: { id: true, title: true, slug: true } } },
    });
    if (!session) throw new AppError(status.NOT_FOUND, "Support session not found.");

    await assertCanManageCourse(user, session.courseId);
    // Ending or calling one off is always allowed; opening one isn't, on a previous course.
    if (nextStatus === SupportSessionStatus.SCHEDULED || nextStatus === SupportSessionStatus.LIVE) {
        await assertSupportOpen(session.courseId);
    }

    const updated = await prisma.supportSession.update({
        where: { id: sessionId },
        data: {
            status: nextStatus,
            // Closing the session releases anyone still waiting rather than
            // leaving them queued for something that will never be served.
            ...(nextStatus === SupportSessionStatus.ENDED ||
                nextStatus === SupportSessionStatus.CANCELLED
                ? {
                    queue: {
                        updateMany: {
                            where: { status: { in: [SupportQueueStatus.WAITING, SupportQueueStatus.SERVING] } },
                            data: { status: SupportQueueStatus.LEFT },
                        },
                    },
                }
                : {}),
        },
    });

    emitSessionStatus(sessionId, {
        sessionId,
        status: updated.status,
        isLive: computeLive(updated),
    });
    await broadcastQueue(sessionId);

    // Called off before it was over: they were told it was on, so tell them it's off.
    const callingOff =
        nextStatus === SupportSessionStatus.CANCELLED &&
        session.status !== SupportSessionStatus.CANCELLED &&
        session.status !== SupportSessionStatus.ENDED &&
        session.endTime.getTime() > Date.now();
    if (callingOff) {
        await notifyEnrolled(session.course, {
            title: "Support session cancelled",
            message: `${session.course.title}'s support session on ${dhakaWhen(session.startTime)} is cancelled.`,
            senderId: user.userId,
        });
    }

    return { ...updated, isLive: computeLive(updated) };
};

/**
 * A course moved to previous holds no support sessions: each one still to
 * come or running is called off and anyone in its line let go. Runs inside
 * the course's own update, so the move and the cancellations land together;
 * returns the sessions it called off for `announceSupportClosed`.
 */
export const cancelOpenSessions = async (tx: Prisma.TransactionClient, courseId: string) => {
    const open = await tx.supportSession.findMany({
        where: {
            courseId,
            status: { in: [SupportSessionStatus.SCHEDULED, SupportSessionStatus.LIVE] },
            endTime: { gt: new Date() },
        },
        select: { id: true },
    });
    const ids = open.map((session) => session.id);
    if (ids.length === 0) return ids;

    await tx.supportQueue.updateMany({
        where: { sessionId: { in: ids }, status: { in: [SupportQueueStatus.WAITING, SupportQueueStatus.SERVING] } },
        data: { status: SupportQueueStatus.LEFT },
    });
    await tx.supportSession.updateMany({ where: { id: { in: ids } }, data: { status: SupportSessionStatus.CANCELLED } });
    return ids;
};

/** After `cancelOpenSessions` commits: open boards close, and the course hears it once, not per session. */
export const announceSupportClosed = async (
    course: { id: string; title: string; slug: string },
    sessionIds: string[],
    actorId?: string,
) => {
    if (sessionIds.length === 0) return;
    for (const sessionId of sessionIds) {
        emitSessionStatus(sessionId, { sessionId, status: SupportSessionStatus.CANCELLED, isLive: false });
        await broadcastQueue(sessionId);
    }
    await notifyEnrolled(course, {
        title: "Support sessions cancelled",
        message: `${course.title} is now a previous recorded course, so its upcoming support sessions are cancelled.`,
        senderId: actorId,
    });
    logger.update("Previous course's support sessions cancelled", { courseId: course.id, sessions: sessionIds.length });
};

/**
 * The sessions this person hosted that are over — past their window, ended or
 * cancelled — newest first, a page at a time, each with how its line went:
 * how many joined, were helped, were skipped or left. Counts only.
 */
const getMyPastSessions = async (user: IRequestUser, query: { page?: unknown; limit?: unknown }) => {
    const now = new Date();
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(query.limit) || 20));
    const where = {
        mentorId: user.userId,
        OR: [
            { endTime: { lt: now } },
            { status: { in: [SupportSessionStatus.ENDED, SupportSessionStatus.CANCELLED] } },
        ],
    };

    const [total, sessions] = await Promise.all([
        prisma.supportSession.count({ where }),
        prisma.supportSession.findMany({
            where,
            orderBy: { startTime: "desc" },
            skip: (page - 1) * limit,
            take: limit,
            include: { course: { select: { id: true, title: true, slug: true } } },
        }),
    ]);

    const groups = sessions.length
        ? await prisma.supportQueue.groupBy({
            by: ["sessionId", "status"],
            where: { sessionId: { in: sessions.map((session) => session.id) } },
            _count: { _all: true },
        })
        : [];
    const count = (sessionId: string, status?: SupportQueueStatus) =>
        groups
            .filter((row) => row.sessionId === sessionId && (!status || row.status === status))
            .reduce((sum, row) => sum + row._count._all, 0);

    return {
        data: sessions.map((session) => ({
            ...session,
            isLive: false,
            attendance: {
                joined: count(session.id),
                helped: count(session.id, SupportQueueStatus.COMPLETED),
                skipped: count(session.id, SupportQueueStatus.SKIPPED),
                left: count(session.id, SupportQueueStatus.LEFT),
            },
        })),
        meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
};

const deleteSession = async (user: IRequestUser, sessionId: string) => {
    const session = await prisma.supportSession.findUnique({
        where: { id: sessionId },
        select: { courseId: true, _count: { select: { queue: true } } },
    });
    if (!session) throw new AppError(status.NOT_FOUND, "Support session not found.");

    await assertCanManageCourse(user, session.courseId);

    // Students who queued have a record of attending; cancelling keeps it.
    if (session._count.queue > 0) {
        throw new AppError(
            status.CONFLICT,
            "Students have already joined this session's queue. Cancel it instead of deleting so attendance is preserved.",
        );
    }

    await prisma.supportSession.delete({ where: { id: sessionId } });
};

const getSessionsByCourse = async (user: IRequestUser, courseId: string) => {
    await assertCanManageCourse(user, courseId);

    const sessions = await prisma.supportSession.findMany({
        where: { courseId },
        orderBy: { startTime: "desc" },
        include: {
            mentor: { select: studentCard },
            _count: { select: { queue: true } },
        },
    });

    return sessions.map((session) => ({ ...session, isLive: computeLive(session) }));
};

// ---------------------------------------------------------------------------
// Admin overview, course by course
// ---------------------------------------------------------------------------

type SessionPhase = "live" | "upcoming" | "held" | "cancelled";

/** Where a session stands right now. "Live" is the clock's call, as everywhere (`computeLive`). */
const phaseOf = (session: { startTime: Date; endTime: Date; status: SupportSessionStatus }, now: number): SessionPhase => {
    if (session.status === SupportSessionStatus.CANCELLED) return "cancelled";
    if (computeLive(session)) return "live";
    if (session.status !== SupportSessionStatus.ENDED && session.startTime.getTime() > now) return "upcoming";
    return "held";
};

interface SupportRollup {
    counts: Record<SessionPhase, number>;
    /** Queue entries across every session — students who took a number. */
    joined: number;
    /** The live session, else the soonest upcoming one. */
    next: { id: string; title: string | null; startTime: Date; endTime: Date; isLive: boolean; mentorName: string } | null;
    lastHeldAt: Date | null;
}

const emptyRollup = (): SupportRollup => ({
    counts: { live: 0, upcoming: 0, held: 0, cancelled: 0 },
    joined: 0,
    next: null,
    lastHeldAt: null,
});

/** Each course's sessions rolled up: how many in each phase, who joined, what's next, when one last ran. */
const summariseSupport = async (courseIds: string[]) => {
    const sessions = await prisma.supportSession.findMany({
        where: { courseId: { in: courseIds } },
        select: {
            id: true,
            courseId: true,
            title: true,
            startTime: true,
            endTime: true,
            status: true,
            mentor: { select: { name: true } },
            _count: { select: { queue: true } },
        },
    });

    const now = Date.now();
    const byCourse = new Map<string, SupportRollup>();
    for (const session of sessions) {
        const rollup = byCourse.get(session.courseId) ?? emptyRollup();
        const phase = phaseOf(session, now);
        rollup.counts[phase] += 1;
        rollup.joined += session._count.queue;

        if ((phase === "live" || phase === "upcoming") && (!rollup.next || session.startTime < rollup.next.startTime)) {
            rollup.next = {
                id: session.id,
                title: session.title,
                startTime: session.startTime,
                endTime: session.endTime,
                isLive: phase === "live",
                mentorName: session.mentor.name,
            };
        }
        if (phase === "held" && (!rollup.lastHeldAt || session.endTime > rollup.lastHeldAt)) {
            rollup.lastHeldAt = session.endTime;
        }
        byCourse.set(session.courseId, rollup);
    }
    return byCourse;
};

const toSupportSummary = (course: AdminCourseCard, rollup: SupportRollup = emptyRollup()) => ({
    course,
    counts: { ...rollup.counts, total: Object.values(rollup.counts).reduce((sum, n) => sum + n, 0) },
    joined: rollup.joined,
    next: rollup.next,
    lastHeldAt: rollup.lastHeldAt,
});

/**
 * Support's first view for admins: every course with its sessions rolled up,
 * so a session is always scheduled from inside the course it belongs to.
 * Courses running a session right now come first, then the soonest next
 * session, then the most recently held.
 */
const getSupportCourses = async () => {
    const courses = await prisma.course.findMany({ where: { isDeleted: false }, select: adminCourseSelect });
    const rollups = await summariseSupport(courses.map((course) => course.id));

    return courses
        .map((course) => toSupportSummary(course, rollups.get(course.id)))
        .sort(
            (a, b) =>
                b.counts.live - a.counts.live ||
                (a.next?.startTime.getTime() ?? Infinity) - (b.next?.startTime.getTime() ?? Infinity) ||
                (b.lastHeldAt?.getTime() ?? 0) - (a.lastHeldAt?.getTime() ?? 0) ||
                a.course.title.localeCompare(b.course.title),
        );
};

/** One course's roll-up for the head of its session list, with the mentors who can host. */
const getSupportCourse = async (courseId: string) => {
    const course = await prisma.course.findFirst({
        where: { id: courseId, isDeleted: false },
        select: {
            ...adminCourseSelect,
            mentors: { orderBy: { order: "asc" }, select: { mentor: { select: studentCard } } },
        },
    });
    if (!course) throw new AppError(status.NOT_FOUND, "Course not found.");

    const { mentors, ...card } = course;
    const rollups = await summariseSupport([courseId]);
    return { ...toSupportSummary(card, rollups.get(courseId)), mentors: mentors.map(({ mentor }) => mentor) };
};

// ---------------------------------------------------------------------------
// Student view
// ---------------------------------------------------------------------------

/**
 * Upcoming and live sessions for a course the student is enrolled on.
 *
 * The meeting link is withheld until the session is actually live (plan §23) —
 * handing it out in advance would let anyone drop into the mentor's Meet room
 * before the session starts.
 */
const getSessionsForStudent = async (user: IRequestUser, courseId: string) => {
    await requireCourseAccess(user, courseId);

    const sessions = await prisma.supportSession.findMany({
        where: {
            courseId,
            // A previous course has none — see `cancelOpenSessions`.
            course: { phase: { not: CoursePhase.PREVIOUS } },
            status: { not: SupportSessionStatus.CANCELLED },
            // Keep recently-ended sessions visible briefly so a student who
            // arrives late understands what happened.
            endTime: { gte: new Date(Date.now() - 60 * 60 * 1000) },
        },
        orderBy: { startTime: "asc" },
        include: {
            mentor: { select: studentCard },
            _count: { select: { queue: { where: { status: SupportQueueStatus.WAITING } } } },
        },
    });

    const myEntries = await prisma.supportQueue.findMany({
        where: { studentId: user.userId, sessionId: { in: sessions.map((s) => s.id) } },
        select: { sessionId: true, queueNumber: true, status: true },
    });
    const mine = new Map(myEntries.map((entry) => [entry.sessionId, entry]));

    return sessions.map((session) => {
        const isLive = computeLive(session);
        return {
            id: session.id,
            title: session.title,
            startTime: session.startTime,
            endTime: session.endTime,
            status: session.status,
            slotMinutes: session.slotMinutes,
            notes: session.notes,
            mentor: session.mentor,
            isLive,
            joinOpen: session.joinOpen,
            waitingCount: session._count.queue,
            meetingLink: isLive ? session.meetingLink : null,
            myQueue: mine.get(session.id) ?? null,
        };
    });
};

/**
 * Builds the public queue board (plan §24): who is being served now, who is
 * waiting, and how long a given student can expect to wait.
 */
const buildQueueBoard = async (sessionId: string) => {
    const session = await prisma.supportSession.findUnique({
        where: { id: sessionId },
        include: {
            mentor: { select: studentCard },
            course: { select: { id: true, title: true, slug: true } },
            queue: {
                where: {
                    status: { in: [SupportQueueStatus.WAITING, SupportQueueStatus.SERVING] },
                },
                orderBy: { queueNumber: "asc" },
                // Pushed to the mentor and to every student watching: a name is all anyone needs.
                include: { student: { select: STUDENT_NAME_ONLY } },
            },
        },
    });
    if (!session) throw new AppError(status.NOT_FOUND, "Support session not found.");

    const serving = session.queue.find((entry) => entry.status === SupportQueueStatus.SERVING) ?? null;
    const waiting = session.queue.filter((entry) => entry.status === SupportQueueStatus.WAITING);
    // How the line has gone so far — counts, for everyone watching.
    const done = await prisma.supportQueue.groupBy({
        by: ["status"],
        where: { sessionId, status: { in: [SupportQueueStatus.COMPLETED, SupportQueueStatus.SKIPPED] } },
        _count: { _all: true },
    });
    const isLive = computeLive(session);

    return {
        sessionId: session.id,
        courseId: session.courseId,
        course: session.course,
        mentor: session.mentor,
        title: session.title,
        // As on the students' page: the room's link only while the session is on.
        meetingLink: isLive ? session.meetingLink : null,
        helpedCount: done.find((row) => row.status === SupportQueueStatus.COMPLETED)?._count._all ?? 0,
        skippedCount: done.find((row) => row.status === SupportQueueStatus.SKIPPED)?._count._all ?? 0,
        status: session.status,
        isLive,
        joinOpen: session.joinOpen,
        startTime: session.startTime,
        endTime: session.endTime,
        slotMinutes: session.slotMinutes,
        nowServing: serving
            ? {
                queueNumber: serving.queueNumber,
                student: serving.student,
                servedAt: serving.servedAt,
                topic: serving.topic,
            }
            : null,
        waiting: waiting.map((entry) => ({
            id: entry.id,
            queueNumber: entry.queueNumber,
            student: entry.student,
            topic: entry.topic,
            joinedAt: entry.joinedAt,
        })),
        waitingCount: waiting.length,
    };
};

const broadcastQueue = async (sessionId: string) => {
    try {
        emitQueueUpdate(sessionId, await buildQueueBoard(sessionId));
    } catch (error) {
        // A failed broadcast must never fail the request that caused it — the
        // REST endpoints remain authoritative.
        logger.error("Failed to broadcast support queue", error);
    }
};

/**
 * Takes the next serial (plan §24). Numbers are assigned in join order and are
 * unique per session; the mentor works down the list by hand.
 */
const joinQueue = async (user: IRequestUser, sessionId: string, topic?: string) => {
    const session = await prisma.supportSession.findUnique({
        where: { id: sessionId },
        select: {
            id: true, courseId: true, startTime: true, endTime: true,
            status: true, slotMinutes: true, joinOpen: true,
        },
    });
    if (!session) throw new AppError(status.NOT_FOUND, "Support session not found.");

    await requireEnrollment(user, session.courseId);
    await assertSupportOpen(session.courseId);

    if (!computeLive(session)) {
        throw new AppError(
            status.BAD_REQUEST,
            session.status === SupportSessionStatus.CANCELLED
                ? "This support session was cancelled."
                : Date.now() < session.startTime.getTime()
                    ? `The support session has not started yet. It runs from ${dhakaClock(session.startTime)}.`
                    : "This support session has ended.",
        );
    }

    const existing = await prisma.supportQueue.findUnique({
        where: { sessionId_studentId: { sessionId, studentId: user.userId } },
    });

    // Rejoining after being served or leaving would jump the student ahead of
    // people who have been waiting; one number per student per session.
    if (existing) {
        if (
            existing.status === SupportQueueStatus.WAITING ||
            existing.status === SupportQueueStatus.SERVING
        ) {
            return existing;
        }
        throw new AppError(
            status.CONFLICT,
            "You've already had your turn in this session's queue.",
        );
    }

    // A closed cutoff only blocks a fresh join — the check above already lets
    // someone already queued back in, e.g. after a duplicate click.
    if (!session.joinOpen) {
        throw new AppError(
            status.BAD_REQUEST,
            "The mentor has closed sign-ups for this session. If you're already in the queue, sit tight.",
        );
    }

    logger.create("Joining support queue", { sessionId, studentId: user.userId });

    // Serial numbers are unique per session, and two students can hit Join at
    // the same instant — retry on the unique violation rather than handing one
    // of them an error.
    let entry;
    for (let attempt = 0; attempt < 5; attempt += 1) {
        const last = await prisma.supportQueue.aggregate({
            where: { sessionId },
            _max: { queueNumber: true },
        });

        try {
            entry = await prisma.supportQueue.create({
                data: {
                    sessionId,
                    studentId: user.userId,
                    queueNumber: (last._max.queueNumber ?? 0) + 1,
                    topic,
                },
            });
            break;
        } catch (error) {
            if ((error as { code?: string }).code !== "P2002") throw error;
        }
    }

    if (!entry) {
        throw new AppError(
            status.CONFLICT,
            "The queue is busy right now. Please try joining again.",
        );
    }

    await awardXp(prisma, {
        studentId: user.userId,
        courseId: session.courseId,
        source: XpSource.SUPPORT_PARTICIPATION,
        refId: sessionId,
    });

    await broadcastQueue(sessionId);
    return entry;
};

const leaveQueue = async (user: IRequestUser, sessionId: string) => {
    const { count } = await prisma.supportQueue.updateMany({
        where: {
            sessionId,
            studentId: user.userId,
            status: { in: [SupportQueueStatus.WAITING, SupportQueueStatus.SERVING] },
        },
        data: { status: SupportQueueStatus.LEFT },
    });

    if (count === 0) {
        throw new AppError(status.NOT_FOUND, "You are not in this session's queue.");
    }

    await broadcastQueue(sessionId);
};

/**
 * The student's own position (plan §24): their number, how many are ahead, and
 * an estimated wait.
 *
 * The estimate is `peopleAhead × slotMinutes` and is explicitly only an
 * estimate — the mentor advances the queue by hand, so a long question pushes
 * everyone back and a quick one pulls them forward.
 */
const getMyQueuePosition = async (user: IRequestUser, sessionId: string) => {
    const session = await prisma.supportSession.findUnique({
        where: { id: sessionId },
        select: { id: true, courseId: true, slotMinutes: true, startTime: true, endTime: true, status: true },
    });
    if (!session) throw new AppError(status.NOT_FOUND, "Support session not found.");

    await requireCourseAccess(user, session.courseId);

    const mine = await prisma.supportQueue.findUnique({
        where: { sessionId_studentId: { sessionId, studentId: user.userId } },
    });

    const board = await buildQueueBoard(sessionId);

    if (!mine || (mine.status !== SupportQueueStatus.WAITING && mine.status !== SupportQueueStatus.SERVING)) {
        return {
            inQueue: false,
            myStatus: mine?.status ?? null,
            myQueueNumber: mine?.queueNumber ?? null,
            nowServing: board.nowServing?.queueNumber ?? null,
            waitingCount: board.waitingCount,
            isLive: board.isLive,
        };
    }

    const peopleAhead = board.waiting.filter((entry) => entry.queueNumber < mine.queueNumber).length;

    return {
        inQueue: true,
        myStatus: mine.status,
        myQueueNumber: mine.queueNumber,
        nowServing: board.nowServing?.queueNumber ?? null,
        peopleAhead,
        estimatedWaitMinutes:
            mine.status === SupportQueueStatus.SERVING ? 0 : peopleAhead * session.slotMinutes,
        waitingCount: board.waitingCount,
        isLive: board.isLive,
    };
};

// ---------------------------------------------------------------------------
// Mentor queue dashboard (plan §26)
// ---------------------------------------------------------------------------

const getQueue = async (user: IRequestUser, sessionId: string) => {
    const session = await prisma.supportSession.findUnique({
        where: { id: sessionId },
        select: { courseId: true },
    });
    if (!session) throw new AppError(status.NOT_FOUND, "Support session not found.");

    await assertCanManageCourse(user, session.courseId);
    return buildQueueBoard(sessionId);
};

/**
 * Calls the next student. Completes whoever is currently being served, then
 * promotes the lowest waiting serial — this is the mentor's "Done" button
 * (plan §26), and the whole queue is manual by design.
 */
const serveNext = async (user: IRequestUser, sessionId: string, mentorNote?: string) => {
    const session = await prisma.supportSession.findUnique({
        where: { id: sessionId },
        select: { id: true, courseId: true },
    });
    if (!session) throw new AppError(status.NOT_FOUND, "Support session not found.");

    await assertCanManageCourse(user, session.courseId);

    const next = await prisma.$transaction(async (tx) => {
        const current = await tx.supportQueue.findFirst({
            where: { sessionId, status: SupportQueueStatus.SERVING },
        });

        if (current) {
            await tx.supportQueue.update({
                where: { id: current.id },
                data: {
                    status: SupportQueueStatus.COMPLETED,
                    completedAt: new Date(),
                    ...(mentorNote ? { mentorNote } : {}),
                },
            });
        }

        const upcoming = await tx.supportQueue.findFirst({
            where: { sessionId, status: SupportQueueStatus.WAITING },
            orderBy: { queueNumber: "asc" },
        });

        if (!upcoming) return null;

        return tx.supportQueue.update({
            where: { id: upcoming.id },
            data: { status: SupportQueueStatus.SERVING, servedAt: new Date() },
            include: { student: { select: STUDENT_NAME_ONLY } },
        });
    });

    // Tell the student their number is up — they may not be watching the page.
    if (next) {
        await createNotification({
            userId: next.studentId,
            title: "It's your turn 🎧",
            message: `You're now being served in the support session. Join the meeting link.`,
            type: NotificationType.SUPPORT,
            senderId: user.userId,
        });
    }

    await broadcastQueue(sessionId);
    return next;
};

/** Marks the current student done without immediately calling the next one. */
const completeCurrent = async (user: IRequestUser, sessionId: string, mentorNote?: string) => {
    const session = await prisma.supportSession.findUnique({
        where: { id: sessionId },
        select: { courseId: true },
    });
    if (!session) throw new AppError(status.NOT_FOUND, "Support session not found.");

    await assertCanManageCourse(user, session.courseId);

    const current = await prisma.supportQueue.findFirst({
        where: { sessionId, status: SupportQueueStatus.SERVING },
    });
    if (!current) {
        throw new AppError(status.BAD_REQUEST, "No student is currently being served.");
    }

    const completed = await prisma.supportQueue.update({
        where: { id: current.id },
        data: {
            status: SupportQueueStatus.COMPLETED,
            completedAt: new Date(),
            ...(mentorNote ? { mentorNote } : {}),
        },
    });

    await broadcastQueue(sessionId);
    return completed;
};

/** Skips a student who didn't answer when their number came up. */
const skipStudent = async (user: IRequestUser, queueId: string, mentorNote?: string) => {
    const entry = await prisma.supportQueue.findUnique({
        where: { id: queueId },
        include: { session: { select: { id: true, courseId: true } } },
    });
    if (!entry) throw new AppError(status.NOT_FOUND, "Queue entry not found.");

    await assertCanManageCourse(user, entry.session.courseId);

    if (entry.status === SupportQueueStatus.COMPLETED) {
        throw new AppError(status.BAD_REQUEST, "That student has already been served.");
    }

    const skipped = await prisma.supportQueue.update({
        where: { id: queueId },
        data: { status: SupportQueueStatus.SKIPPED, ...(mentorNote ? { mentorNote } : {}) },
    });

    await broadcastQueue(entry.session.id);
    return skipped;
};

/** Full attendance record for a finished session. */
const getSessionHistory = async (user: IRequestUser, sessionId: string) => {
    const session = await prisma.supportSession.findUnique({
        where: { id: sessionId },
        select: { courseId: true },
    });
    if (!session) throw new AppError(status.NOT_FOUND, "Support session not found.");

    await assertCanManageCourse(user, session.courseId);

    return prisma.supportQueue.findMany({
        where: { sessionId },
        orderBy: { queueNumber: "asc" },
        // The attendance record: admins get the contact details, mentors the names.
        include: { student: { select: studentSelectFor(user, { ...studentCard, email: true }) } },
    });
};

// ---------------------------------------------------------------------------
// Release scheduler
// ---------------------------------------------------------------------------

/**
 * Notifies each enrolled student the instant their session's window opens.
 * Called from the scheduler poll (`lib/scheduler.ts`), not a request handler.
 *
 * `liveNotifiedAt IS NULL` is both the "haven't sent it yet" filter and the
 * idempotency guard — it's stamped in the same pass that sends the
 * notification, so a session leaves the matching set the moment this runs
 * and a tick that somehow overlapped a previous one never double-sends.
 * Status stays untouched deliberately: `computeLive` already derives "is it
 * live" from the clock everywhere it's read, so there's nothing here that
 * needs a stored `LIVE` status to be correct — only the one-shot push does.
 */
const notifyLiveSessions = async () => {
    const now = new Date();
    const due = await prisma.supportSession.findMany({
        where: {
            status: { notIn: [SupportSessionStatus.CANCELLED, SupportSessionStatus.ENDED] },
            startTime: { lte: now },
            endTime: { gt: now },
            liveNotifiedAt: null,
            course: { phase: { not: CoursePhase.PREVIOUS } },
        },
        include: { course: { select: { title: true, slug: true } } },
    });
    if (due.length === 0) return;

    for (const session of due) {
        const enrollments = await prisma.enrollment.findMany({
            where: { courseId: session.courseId, status: { not: "CANCELLED" } },
            select: { studentId: true },
        });

        await Promise.all(
            enrollments.map((enrollment) =>
                createNotification({
                    userId: enrollment.studentId,
                    title: "Support session is live now",
                    message: `${session.course.title}'s support session is live — join now.`,
                    type: NotificationType.SUPPORT,
                    link: `/learn/${session.course.slug}/support`,
                }),
            ),
        );

        // And the mentor hosting it — unless they scheduled it to start right
        // away, in which case they're already there. Only a host who teaches
        // the course: the queue board lives in the mentor console.
        const hostTeaches = await prisma.courseMentor.findUnique({
            where: { courseId_mentorId: { courseId: session.courseId, mentorId: session.mentorId } },
            select: { id: true },
        });
        if (hostTeaches && session.startTime.getTime() - session.createdAt.getTime() > 5 * 60_000) {
            await createNotification({
                userId: session.mentorId,
                title: "Your support session is live",
                message: `${session.title || "Support session"} · ${session.course.title} — students can take a number now. Open the queue board to call them.`,
                type: NotificationType.SUPPORT,
                link: `/mentor/support/${session.id}`,
            });
        }

        await prisma.supportSession.update({
            where: { id: session.id },
            data: { liveNotifiedAt: now },
        });

        emitSessionStatus(session.id, { sessionId: session.id, isLive: true, status: session.status });
        logger.create("Notified support session live", { sessionId: session.id, recipients: enrollments.length });
    }
};

export const SupportService = {
    getMyPastSessions,
    createSession,
    updateSession,
    setSessionStatus,
    deleteSession,
    getSessionsByCourse,
    getSupportCourses,
    getSupportCourse,
    getSessionsForStudent,
    joinQueue,
    leaveQueue,
    getMyQueuePosition,
    getQueue,
    serveNext,
    completeCurrent,
    skipStudent,
    getSessionHistory,
    notifyLiveSessions,
};
