import status from "http-status";
import { Prisma } from "../../../generated/prisma/client";
import { EnrollmentStatus, NotificationType } from "../../../generated/prisma/enums";
import AppError from "../../errorHelpers/AppError";
import { IRequestUser } from "../../interfaces/requestUser.interface";
import { prisma } from "../../lib/prisma";
import { adminCourseSelect } from "../../utils/adminCourseSelect";
import { assertCanManageCourse, isCourseAdmin, requireCourseAccess, requireEnrollment } from "../../utils/courseAccess";
import { logger } from "../../utils/logger";
import { applyOrdering, assertCompleteOrdering } from "../../utils/ordering";
import { formatDuration, requireYoutubeVideoId, toSeconds, youtubeThumbnailUrl } from "../../utils/youtube";
import { createNotificationsFor } from "../notification/notification.service";

/**
 * Conceptual sessions (see `conceptual.prisma`): staff file each live class's
 * recording under a topic; enrolled students watch them by topic and tick off
 * what they've seen. A recording reaches students once both it and its topic
 * are published, and the first time that happens they're notified.
 */

/** Enrolments that still open the course: not cancelled, not past an expiry (as `requireCourseAccess`). */
const withAccess = (now: Date) => ({
    status: { not: EnrollmentStatus.CANCELLED },
    OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
});

/** What students can see: published, in a published topic. */
const visible = { isPublished: true, topic: { isPublished: true } } satisfies Prisma.ConceptualSessionWhereInput;

const emptyToNull = (value: string | undefined) => (value === undefined ? undefined : value || null);

const loadTopicForWrite = async (user: IRequestUser, topicId: string) => {
    const topic = await prisma.conceptualTopic.findUnique({
        where: { id: topicId },
        select: { id: true, courseId: true, isPublished: true },
    });
    if (!topic) throw new AppError(status.NOT_FOUND, "Topic not found.");

    await assertCanManageCourse(user, topic.courseId);
    return topic;
};

const loadSessionForWrite = async (user: IRequestUser, sessionId: string) => {
    const session = await prisma.conceptualSession.findUnique({
        where: { id: sessionId },
        select: { id: true, courseId: true, topicId: true },
    });
    if (!session) throw new AppError(status.NOT_FOUND, "Recording not found.");

    await assertCanManageCourse(user, session.courseId);
    return session;
};

/**
 * Tells a course's students about recordings they can see for the first time
 * — called after anything that can make one visible (adding it published,
 * publishing it, publishing its topic). Each recording is claimed by stamping
 * `notifiedAt` before anyone is told, so two publishes racing each other
 * can't announce it twice. Never throws: the publish has already happened.
 */
const announceNewRecordings = async (where: { sessionIds: string[] } | { topicId: string }) => {
    try {
        const fresh = await prisma.conceptualSession.findMany({
            where: {
                ...("topicId" in where ? { topicId: where.topicId } : { id: { in: where.sessionIds } }),
                ...visible,
                notifiedAt: null,
            },
            orderBy: [{ topic: { order: "asc" } }, { order: "asc" }],
            select: {
                id: true,
                title: true,
                courseId: true,
                topic: { select: { title: true } },
                course: { select: { title: true, slug: true } },
            },
        });
        if (fresh.length === 0) return;

        const { count } = await prisma.conceptualSession.updateMany({
            where: { id: { in: fresh.map((session) => session.id) }, notifiedAt: null },
            data: { notifiedAt: new Date() },
        });
        if (count === 0) return;

        // Every caller passes recordings of one topic, so one course.
        const [first] = fresh;
        const students = await prisma.enrollment.findMany({
            where: { courseId: first.courseId, ...withAccess(new Date()) },
            select: { studentId: true },
        });

        const recipients = await createNotificationsFor(
            students.map((enrollment) => enrollment.studentId),
            {
                type: NotificationType.COURSE,
                title:
                    fresh.length === 1
                        ? "New conceptual session recording"
                        : `${fresh.length} new conceptual session recordings`,
                message:
                    fresh.length === 1
                        ? `“${first.title}” from ${first.topic.title} is up — ${first.course.title}.`
                        : `New recordings in ${first.topic.title} are up — ${first.course.title}.`,
                link: `/learn/${first.course.slug}/conceptual?session=${first.id}`,
            },
        );
        logger.create("Conceptual recordings announced", { courseId: first.courseId, recordings: count, recipients });
    } catch (error) {
        logger.error("Failed to announce conceptual session recordings", error);
    }
};

// ---------------------------------------------------------------------------
// Staff
// ---------------------------------------------------------------------------

/**
 * The courses this person can file recordings under — every course for an
 * admin, the assigned ones for a mentor — each with its topics and
 * recordings counted. Courses with the newest recordings come first.
 */
const getManageCourses = async (user: IRequestUser) => {
    const courses = await prisma.course.findMany({
        where: isCourseAdmin(user)
            ? { isDeleted: false }
            : { isDeleted: false, mentors: { some: { mentorId: user.userId } } },
        select: adminCourseSelect,
    });
    if (courses.length === 0) return [];

    const courseIds = { courseId: { in: courses.map((course) => course.id) } };
    const [topics, sessions, live, students] = await Promise.all([
        prisma.conceptualTopic.groupBy({ by: ["courseId", "isPublished"], where: courseIds, _count: { _all: true } }),
        prisma.conceptualSession.groupBy({
            by: ["courseId"],
            where: courseIds,
            _count: { _all: true },
            _max: { createdAt: true },
        }),
        prisma.conceptualSession.groupBy({
            by: ["courseId"],
            where: { ...courseIds, ...visible },
            _count: { _all: true },
            _sum: { duration: true },
        }),
        prisma.enrollment.groupBy({
            by: ["courseId"],
            where: { ...courseIds, ...withAccess(new Date()) },
            _count: { _all: true },
        }),
    ]);

    const sessionsByCourse = new Map(sessions.map((row) => [row.courseId, row]));
    const liveByCourse = new Map(live.map((row) => [row.courseId, row]));
    const studentsByCourse = new Map(students.map((row) => [row.courseId, row._count._all]));

    return courses
        .map((course) => {
            const courseTopics = topics.filter((row) => row.courseId === course.id);
            const all = sessionsByCourse.get(course.id);
            const shown = liveByCourse.get(course.id);
            return {
                course,
                topics: {
                    total: courseTopics.reduce((sum, row) => sum + row._count._all, 0),
                    live: courseTopics.find((row) => row.isPublished)?._count._all ?? 0,
                },
                recordings: { total: all?._count._all ?? 0, live: shown?._count._all ?? 0 },
                /** Running time of what students can see, in seconds. */
                liveDuration: shown?._sum.duration ?? 0,
                students: studentsByCourse.get(course.id) ?? 0,
                lastAddedAt: all?._max.createdAt ?? null,
            };
        })
        .sort(
            (a, b) =>
                (b.lastAddedAt?.getTime() ?? 0) - (a.lastAddedAt?.getTime() ?? 0) ||
                a.course.title.localeCompare(b.course.title),
        );
};

/** One course's topics with every recording in them, drafts included, for the manager. */
const getManageCourse = async (user: IRequestUser, courseId: string) => {
    await assertCanManageCourse(user, courseId);

    const [course, topics, students] = await Promise.all([
        prisma.course.findUniqueOrThrow({ where: { id: courseId }, select: adminCourseSelect }),
        prisma.conceptualTopic.findMany({
            where: { courseId },
            orderBy: { order: "asc" },
            include: {
                sessions: {
                    orderBy: { order: "asc" },
                    include: { _count: { select: { watches: true } } },
                },
            },
        }),
        prisma.enrollment.count({ where: { courseId, ...withAccess(new Date()) } }),
    ]);

    return { course, students, topics };
};

const createTopic = async (
    user: IRequestUser,
    payload: { courseId: string; title: string; description?: string; isPublished?: boolean },
) => {
    await assertCanManageCourse(user, payload.courseId);
    logger.create("Adding conceptual topic", { courseId: payload.courseId });

    // New topics go last; the manager reorders them by drag.
    return prisma.$transaction(async (tx) => {
        const last = await tx.conceptualTopic.aggregate({
            where: { courseId: payload.courseId },
            _max: { order: true },
        });
        return tx.conceptualTopic.create({
            data: {
                courseId: payload.courseId,
                title: payload.title,
                description: emptyToNull(payload.description),
                isPublished: payload.isPublished ?? false,
                order: (last._max.order ?? 0) + 1,
            },
            include: { sessions: { include: { _count: { select: { watches: true } } } } },
        });
    });
};

const updateTopic = async (
    user: IRequestUser,
    topicId: string,
    payload: { title?: string; description?: string; isPublished?: boolean },
) => {
    const topic = await loadTopicForWrite(user, topicId);

    const updated = await prisma.conceptualTopic.update({
        where: { id: topicId },
        data: {
            title: payload.title,
            description: emptyToNull(payload.description),
            isPublished: payload.isPublished,
        },
    });

    // Publishing a topic shows every published recording already inside it.
    if (payload.isPublished && !topic.isPublished) await announceNewRecordings({ topicId });

    return updated;
};

const deleteTopic = async (user: IRequestUser, topicId: string) => {
    const topic = await loadTopicForWrite(user, topicId);
    logger.delete("Deleting conceptual topic", { topicId });

    await prisma.$transaction(async (tx) => {
        // Its recordings and their watched ticks go with it (cascade).
        await tx.conceptualTopic.delete({ where: { id: topicId } });

        const remaining = await tx.conceptualTopic.findMany({
            where: { courseId: topic.courseId },
            orderBy: { order: "asc" },
            select: { id: true },
        });
        await applyOrdering(remaining.map((row) => row.id), (id, order) =>
            tx.conceptualTopic.update({ where: { id }, data: { order } }),
        );
    });
};

const reorderTopics = async (user: IRequestUser, courseId: string, orderedIds: string[]) => {
    await assertCanManageCourse(user, courseId);

    await prisma.$transaction(async (tx) => {
        const existing = await tx.conceptualTopic.findMany({ where: { courseId }, select: { id: true } });
        assertCompleteOrdering(orderedIds, existing.map((row) => row.id));
        await applyOrdering(orderedIds, (id, order) => tx.conceptualTopic.update({ where: { id }, data: { order } }));
    });

    return prisma.conceptualTopic.findMany({ where: { courseId }, orderBy: { order: "asc" }, select: { id: true, order: true } });
};

const createSession = async (
    user: IRequestUser,
    payload: {
        topicId: string;
        title: string;
        youtubeUrl: string;
        duration?: string | number;
        description?: string;
        isPublished?: boolean;
    },
) => {
    const topic = await loadTopicForWrite(user, payload.topicId);
    // Parsed now, so a bad link is refused here rather than failing in the player.
    const youtubeVideoId = requireYoutubeVideoId(payload.youtubeUrl);
    logger.create("Adding conceptual recording", { topicId: topic.id });

    const session = await prisma.$transaction(async (tx) => {
        const last = await tx.conceptualSession.aggregate({ where: { topicId: topic.id }, _max: { order: true } });
        return tx.conceptualSession.create({
            data: {
                topicId: topic.id,
                courseId: topic.courseId,
                title: payload.title,
                description: emptyToNull(payload.description),
                youtubeUrl: payload.youtubeUrl,
                youtubeVideoId,
                thumbnail: youtubeThumbnailUrl(youtubeVideoId),
                duration: toSeconds(payload.duration),
                isPublished: payload.isPublished ?? false,
                order: (last._max.order ?? 0) + 1,
            },
            include: { _count: { select: { watches: true } } },
        });
    });

    if (session.isPublished) await announceNewRecordings({ sessionIds: [session.id] });
    return session;
};

const updateSession = async (
    user: IRequestUser,
    sessionId: string,
    payload: {
        title?: string;
        youtubeUrl?: string;
        duration?: string | number;
        description?: string;
        isPublished?: boolean;
        topicId?: string;
    },
) => {
    const session = await loadSessionForWrite(user, sessionId);

    const data: Prisma.ConceptualSessionUncheckedUpdateInput = {
        title: payload.title,
        description: emptyToNull(payload.description),
        isPublished: payload.isPublished,
    };
    if (payload.youtubeUrl !== undefined) {
        const youtubeVideoId = requireYoutubeVideoId(payload.youtubeUrl);
        data.youtubeUrl = payload.youtubeUrl;
        data.youtubeVideoId = youtubeVideoId;
        data.thumbnail = youtubeThumbnailUrl(youtubeVideoId);
    }
    if (payload.duration !== undefined) data.duration = toSeconds(payload.duration);

    const moving = payload.topicId !== undefined && payload.topicId !== session.topicId;
    if (moving) {
        const target = await prisma.conceptualTopic.findUnique({
            where: { id: payload.topicId },
            select: { courseId: true },
        });
        if (!target || target.courseId !== session.courseId) {
            throw new AppError(status.BAD_REQUEST, "A recording can only move to another topic of the same course.");
        }
    }

    const updated = await prisma.$transaction(async (tx) => {
        if (!moving) {
            return tx.conceptualSession.update({
                where: { id: sessionId },
                data,
                include: { _count: { select: { watches: true } } },
            });
        }

        // To the end of the new topic, then close the gap it left behind.
        const last = await tx.conceptualSession.aggregate({
            where: { topicId: payload.topicId },
            _max: { order: true },
        });
        const moved = await tx.conceptualSession.update({
            where: { id: sessionId },
            data: { ...data, topicId: payload.topicId, order: (last._max.order ?? 0) + 1 },
            include: { _count: { select: { watches: true } } },
        });
        const left = await tx.conceptualSession.findMany({
            where: { topicId: session.topicId },
            orderBy: { order: "asc" },
            select: { id: true },
        });
        await applyOrdering(left.map((row) => row.id), (id, order) =>
            tx.conceptualSession.update({ where: { id }, data: { order } }),
        );
        return moved;
    });

    if (updated.isPublished) await announceNewRecordings({ sessionIds: [updated.id] });
    return updated;
};

const deleteSession = async (user: IRequestUser, sessionId: string) => {
    const session = await loadSessionForWrite(user, sessionId);
    logger.delete("Deleting conceptual recording", { sessionId });

    await prisma.$transaction(async (tx) => {
        await tx.conceptualSession.delete({ where: { id: sessionId } });

        const remaining = await tx.conceptualSession.findMany({
            where: { topicId: session.topicId },
            orderBy: { order: "asc" },
            select: { id: true },
        });
        await applyOrdering(remaining.map((row) => row.id), (id, order) =>
            tx.conceptualSession.update({ where: { id }, data: { order } }),
        );
    });
};

const reorderSessions = async (user: IRequestUser, topicId: string, orderedIds: string[]) => {
    await loadTopicForWrite(user, topicId);

    await prisma.$transaction(async (tx) => {
        const existing = await tx.conceptualSession.findMany({ where: { topicId }, select: { id: true } });
        assertCompleteOrdering(orderedIds, existing.map((row) => row.id));
        await applyOrdering(orderedIds, (id, order) => tx.conceptualSession.update({ where: { id }, data: { order } }));
    });

    return prisma.conceptualSession.findMany({ where: { topicId }, orderBy: { order: "asc" }, select: { id: true, order: true } });
};

// ---------------------------------------------------------------------------
// Students
// ---------------------------------------------------------------------------

/**
 * The student's courses that have recordings they can watch, each with its
 * counts, how many they've ticked off, the newest recording and the first one
 * they haven't watched. Courses with the newest recordings come first.
 */
const getMyCourses = async (user: IRequestUser) => {
    const enrollments = await prisma.enrollment.findMany({
        where: { studentId: user.userId, ...withAccess(new Date()), course: { isDeleted: false } },
        select: {
            course: { select: { id: true, title: true, slug: true, thumbnail: true, courseType: true } },
        },
    });
    if (enrollments.length === 0) return [];

    const sessions = await prisma.conceptualSession.findMany({
        where: { courseId: { in: enrollments.map((e) => e.course.id) }, ...visible },
        // Course order: topic by topic, so the first unwatched one is "up next".
        orderBy: [{ topic: { order: "asc" } }, { order: "asc" }],
        select: {
            id: true,
            title: true,
            courseId: true,
            topicId: true,
            duration: true,
            createdAt: true,
            watches: { where: { studentId: user.userId }, select: { id: true } },
        },
    });

    return enrollments
        .map(({ course }) => {
            const own = sessions.filter((session) => session.courseId === course.id);
            const newest = own.reduce<(typeof own)[number] | null>(
                (latest, session) => (!latest || session.createdAt > latest.createdAt ? session : latest),
                null,
            );
            const next = own.find((session) => session.watches.length === 0) ?? null;
            return {
                course,
                topics: new Set(own.map((session) => session.topicId)).size,
                recordings: own.length,
                watched: own.filter((session) => session.watches.length > 0).length,
                /** Seconds. */
                totalDuration: own.reduce((sum, session) => sum + session.duration, 0),
                latest: newest && { id: newest.id, title: newest.title, addedAt: newest.createdAt },
                next: next && { id: next.id, title: next.title },
            };
        })
        .filter((summary) => summary.recordings > 0)
        .sort((a, b) => (b.latest?.addedAt.getTime() ?? 0) - (a.latest?.addedAt.getTime() ?? 0));
};

/** One course's recordings, topic by topic, as the student's player shows them. */
const getCourseSessions = async (user: IRequestUser, slug: string) => {
    const course = await prisma.course.findFirst({
        where: { slug, isDeleted: false },
        select: { id: true, title: true, slug: true, thumbnail: true, courseType: true },
    });
    if (!course) throw new AppError(status.NOT_FOUND, "Course not found.");

    await requireCourseAccess(user, course.id);

    const topics = await prisma.conceptualTopic.findMany({
        where: { courseId: course.id, isPublished: true },
        orderBy: { order: "asc" },
        select: {
            id: true,
            title: true,
            description: true,
            sessions: {
                where: { isPublished: true },
                orderBy: { order: "asc" },
                select: {
                    id: true,
                    title: true,
                    description: true,
                    youtubeVideoId: true,
                    thumbnail: true,
                    duration: true,
                    watches: { where: { studentId: user.userId }, select: { id: true } },
                },
            },
        },
    });

    return {
        course,
        // A topic with nothing published in it yet has nothing to show.
        topics: topics
            .filter((topic) => topic.sessions.length > 0)
            .map((topic) => ({
                id: topic.id,
                title: topic.title,
                description: topic.description,
                sessions: topic.sessions.map(({ watches, ...session }) => ({
                    ...session,
                    durationLabel: session.duration > 0 ? formatDuration(session.duration) : null,
                    isWatched: watches.length > 0,
                })),
            })),
    };
};

/** Ticks a recording watched, or takes the tick off. */
const setWatched = async (user: IRequestUser, sessionId: string, watched: boolean) => {
    const session = await prisma.conceptualSession.findFirst({
        where: { id: sessionId, ...visible },
        select: { id: true, courseId: true },
    });
    if (!session) throw new AppError(status.NOT_FOUND, "Recording not found.");

    await requireEnrollment(user, session.courseId);

    if (watched) {
        await prisma.conceptualSessionWatch.upsert({
            where: { sessionId_studentId: { sessionId, studentId: user.userId } },
            create: { sessionId, studentId: user.userId },
            update: {},
        });
    } else {
        await prisma.conceptualSessionWatch.deleteMany({ where: { sessionId, studentId: user.userId } });
    }

    return { sessionId, isWatched: watched };
};

export const ConceptualService = {
    getManageCourses,
    getManageCourse,
    createTopic,
    updateTopic,
    deleteTopic,
    reorderTopics,
    createSession,
    updateSession,
    deleteSession,
    reorderSessions,
    getMyCourses,
    getCourseSessions,
    setWatched,
};
