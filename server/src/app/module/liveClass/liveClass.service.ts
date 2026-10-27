import status from "http-status";
import { Prisma } from "../../../generated/prisma/client";
import { LiveClassStatus, NotificationType } from "../../../generated/prisma/enums";
import AppError from "../../errorHelpers/AppError";
import { IRequestUser } from "../../interfaces/requestUser.interface";
import { prisma } from "../../lib/prisma";
import { assertCanManageCourse, requireCourseAccess } from "../../utils/courseAccess";
import { dhakaWhen } from "../../utils/dhakaTime";
import { logger } from "../../utils/logger";
import { createNotificationsFor } from "../notification/notification.service";

/** The meeting link opens to students this long before the start, and stays open until the end. */
export const JOIN_OPENS_MINUTES = 30;
/** The "starting soon" nudge goes out this long before. */
const REMIND_MINUTES = 15;

const MINUTE = 60_000;
const endOf = (liveClass: { startsAt: Date; durationMinutes: number }) => new Date(liveClass.startsAt.getTime() + liveClass.durationMinutes * MINUTE);

const staffInclude = {
    topic: { select: { id: true, title: true } },
    createdBy: { select: { id: true, name: true } },
} satisfies Prisma.LiveClassInclude;

/** Everyone who can still open the course, told about one of its classes. */
const tellCourse = async (
    course: { id: string; slug: string },
    input: { title: string; message: string; senderId?: string; email: boolean },
) => {
    const enrollments = await prisma.enrollment.findMany({
        where: { courseId: course.id, status: { not: "CANCELLED" } },
        select: { studentId: true },
    });
    return createNotificationsFor(
        enrollments.map((enrollment) => enrollment.studentId),
        {
            title: input.title,
            message: input.message,
            senderId: input.senderId,
            type: NotificationType.COURSE,
            link: `/learn/${course.slug}/conceptual`,
            ...(input.email ? { email: { actionLabel: "See the class" } } : {}),
        },
    );
};

/** A topic named for the class must be one of this course's. */
const assertTopicOf = async (courseId: string, topicId: string | null | undefined) => {
    if (!topicId) return;
    const topic = await prisma.conceptualTopic.findFirst({ where: { id: topicId, courseId }, select: { id: true } });
    if (!topic) throw new AppError(status.BAD_REQUEST, "That topic isn't on this course.");
};

/** The course's classes for its staff: everything from two weeks back on, soonest first. */
const listForStaff = async (user: IRequestUser, courseId: string) => {
    await assertCanManageCourse(user, courseId);
    return prisma.liveClass.findMany({
        where: { courseId, startsAt: { gte: new Date(Date.now() - 14 * 24 * 60 * MINUTE) } },
        orderBy: { startsAt: "asc" },
        include: staffInclude,
    });
};

/**
 * A class as a student sees it: the meeting link only while it's open to
 * join (from shortly before the start to the end), so it isn't passed round
 * days ahead — `hasLink` says one is set.
 */
const forStudent = (
    liveClass: Prisma.LiveClassGetPayload<{ include: { topic: { select: { id: true; title: true } } } }>,
    now: number,
) => {
    const opens = liveClass.startsAt.getTime() - JOIN_OPENS_MINUTES * MINUTE;
    const ends = endOf(liveClass).getTime();
    const open = liveClass.status === LiveClassStatus.SCHEDULED && now >= opens && now <= ends;
    return {
        id: liveClass.id,
        courseId: liveClass.courseId,
        title: liveClass.title,
        description: liveClass.description,
        startsAt: liveClass.startsAt,
        endsAt: endOf(liveClass),
        durationMinutes: liveClass.durationMinutes,
        status: liveClass.status,
        topic: liveClass.topic,
        isLive: liveClass.status === LiveClassStatus.SCHEDULED && now >= liveClass.startsAt.getTime() && now <= ends,
        hasLink: Boolean(liveClass.joinUrl),
        joinOpensAt: new Date(opens),
        joinUrl: open ? liveClass.joinUrl : null,
    };
};

/** Classes still to come (or on now) — cancelled ones too, so a student sees it's off. */
const upcomingWhere = (now: Date) => ({
    startsAt: { gte: new Date(now.getTime() - 6 * 60 * MINUTE) },
    OR: [{ status: LiveClassStatus.SCHEDULED }, { status: LiveClassStatus.CANCELLED, startsAt: { gte: now } }],
});

/** One course's upcoming classes, for a student on it. */
const listForLearner = async (user: IRequestUser, slug: string) => {
    const course = await prisma.course.findFirst({ where: { slug, isDeleted: false }, select: { id: true, title: true, slug: true } });
    if (!course) throw new AppError(status.NOT_FOUND, "Course not found.");
    await requireCourseAccess(user, course.id);

    const now = new Date();
    const classes = await prisma.liveClass.findMany({
        where: { courseId: course.id, ...upcomingWhere(now) },
        orderBy: { startsAt: "asc" },
        take: 20,
        include: { topic: { select: { id: true, title: true } } },
    });
    return {
        course,
        classes: classes.filter((entry) => endOf(entry) >= now).map((entry) => forStudent(entry, now.getTime())),
    };
};

/** Every course the student is on: their next classes, soonest first — for their dashboard. */
const listMine = async (user: IRequestUser) => {
    const now = new Date();
    const enrollments = await prisma.enrollment.findMany({
        where: { studentId: user.userId, status: { in: ["ACTIVE", "COMPLETED"] } },
        select: { courseId: true },
    });
    if (enrollments.length === 0) return [];
    const classes = await prisma.liveClass.findMany({
        where: { courseId: { in: enrollments.map((entry) => entry.courseId) }, ...upcomingWhere(now), status: LiveClassStatus.SCHEDULED },
        orderBy: { startsAt: "asc" },
        take: 10,
        include: { topic: { select: { id: true, title: true } }, course: { select: { id: true, title: true, slug: true } } },
    });
    return classes
        .filter((entry) => endOf(entry) >= now)
        .map((entry) => ({ ...forStudent(entry, now.getTime()), course: entry.course }));
};

const create = async (
    user: IRequestUser,
    courseId: string,
    payload: { title: string; description?: string; startsAt: Date; durationMinutes?: number; joinUrl?: string; topicId?: string },
) => {
    await assertCanManageCourse(user, courseId);
    if (payload.startsAt.getTime() < Date.now() - 5 * MINUTE) {
        throw new AppError(status.BAD_REQUEST, "Pick a time that hasn't passed.");
    }
    await assertTopicOf(courseId, payload.topicId);
    const course = await prisma.course.findUniqueOrThrow({ where: { id: courseId }, select: { id: true, slug: true, title: true } });

    const liveClass = await prisma.liveClass.create({
        data: { ...payload, courseId, createdById: user.userId },
        include: staffInclude,
    });
    const told = await tellCourse(course, {
        title: `Live class: ${liveClass.title}`,
        message: `${course.title} has a live class on ${dhakaWhen(liveClass.startsAt)} (Dhaka time), ${liveClass.durationMinutes} minutes. The link opens ${JOIN_OPENS_MINUTES} minutes before.`,
        senderId: user.userId,
        email: true,
    });
    return { ...liveClass, recipients: told };
};

const loadForChange = async (user: IRequestUser, liveClassId: string) => {
    const liveClass = await prisma.liveClass.findUnique({
        where: { id: liveClassId },
        include: { course: { select: { id: true, slug: true, title: true } } },
    });
    if (!liveClass) throw new AppError(status.NOT_FOUND, "Live class not found.");
    await assertCanManageCourse(user, liveClass.courseId);
    return liveClass;
};

/**
 * Edits a class. Moving it tells the students (and earns the new time its
 * own reminder); a new title, link or note goes quietly.
 */
const update = async (
    user: IRequestUser,
    liveClassId: string,
    payload: {
        title?: string;
        description?: string | null;
        startsAt?: Date;
        durationMinutes?: number;
        joinUrl?: string | null;
        topicId?: string | null;
    },
) => {
    const liveClass = await loadForChange(user, liveClassId);
    if (liveClass.status === LiveClassStatus.CANCELLED) {
        throw new AppError(status.CONFLICT, "This class was cancelled — schedule a new one instead.");
    }
    if (payload.topicId !== undefined) await assertTopicOf(liveClass.courseId, payload.topicId);

    const moved = payload.startsAt !== undefined && payload.startsAt.getTime() !== liveClass.startsAt.getTime();
    if (moved && payload.startsAt!.getTime() < Date.now() - 5 * MINUTE) {
        throw new AppError(status.BAD_REQUEST, "Pick a time that hasn't passed.");
    }

    const updated = await prisma.liveClass.update({
        where: { id: liveClassId },
        data: { ...payload, ...(moved ? { remindedAt: null } : {}) },
        include: staffInclude,
    });
    if (moved) {
        await tellCourse(liveClass.course, {
            title: `Live class moved: ${updated.title}`,
            message: `${liveClass.course.title}'s live class is now on ${dhakaWhen(updated.startsAt)} (Dhaka time).`,
            senderId: user.userId,
            email: true,
        });
    }
    return updated;
};

/** Calls a class off and tells everyone. It stays on the list, marked cancelled. */
const cancel = async (user: IRequestUser, liveClassId: string) => {
    const liveClass = await loadForChange(user, liveClassId);
    if (liveClass.status === LiveClassStatus.CANCELLED) return liveClass;
    if (endOf(liveClass) < new Date()) throw new AppError(status.CONFLICT, "This class is already over.");

    const cancelled = await prisma.liveClass.update({
        where: { id: liveClassId },
        data: { status: LiveClassStatus.CANCELLED },
        include: staffInclude,
    });
    await tellCourse(liveClass.course, {
        title: `Live class cancelled: ${liveClass.title}`,
        message: `${liveClass.course.title}'s live class on ${dhakaWhen(liveClass.startsAt)} is cancelled.`,
        senderId: user.userId,
        email: true,
    });
    return cancelled;
};

/** Removes a class from the list — one that's over or already cancelled; an upcoming one is cancelled first, so students hear. */
const remove = async (user: IRequestUser, liveClassId: string) => {
    const liveClass = await loadForChange(user, liveClassId);
    const upcoming = liveClass.status === LiveClassStatus.SCHEDULED && endOf(liveClass) >= new Date();
    if (upcoming) throw new AppError(status.CONFLICT, "Cancel the class first, so its students are told.");
    await prisma.liveClass.delete({ where: { id: liveClassId } });
};

let warnedMissingTable = false;

/**
 * The scheduler's "starting soon" nudge: once per class, about fifteen
 * minutes before. Claimed with a conditional update, so a slow tick can't
 * send it twice.
 */
const remindStartingClasses = async () => {
    const now = new Date();
    try {
        const due = await prisma.liveClass.findMany({
            where: {
                status: LiveClassStatus.SCHEDULED,
                remindedAt: null,
                startsAt: { gt: new Date(now.getTime() - 5 * MINUTE), lte: new Date(now.getTime() + REMIND_MINUTES * MINUTE) },
            },
            include: { course: { select: { id: true, slug: true, title: true } } },
        });
        for (const liveClass of due) {
            const claimed = await prisma.liveClass.updateMany({ where: { id: liveClass.id, remindedAt: null }, data: { remindedAt: now } });
            if (claimed.count === 0) continue;
            await tellCourse(liveClass.course, {
                title: `Starting soon: ${liveClass.title}`,
                message: `${liveClass.course.title}'s live class starts at ${dhakaWhen(liveClass.startsAt)}. The link is open now.`,
                email: false,
            });
        }
    } catch (error) {
        // Before the teaching_and_commerce migration is applied the table isn't there yet: say so once, not every tick.
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2021") {
            if (!warnedMissingTable) logger.warn("Live class reminders are off: the live_class table doesn't exist yet (apply the migration).");
            warnedMissingTable = true;
            return;
        }
        throw error;
    }
};

export const LiveClassService = { listForStaff, listForLearner, listMine, create, update, cancel, remove, remindStartingClasses };
