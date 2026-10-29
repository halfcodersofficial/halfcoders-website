import { createHash } from "crypto";
import status from "http-status";
import { Prisma } from "../../../generated/prisma/client";
import { AccountStatus, LearningStatus, NotificationType } from "../../../generated/prisma/enums";
import { Role } from "../../lib/roles";
import AppError from "../../errorHelpers/AppError";
import { IQueryParams } from "../../interfaces/query.interface";
import { IRequestUser } from "../../interfaces/requestUser.interface";
import { activeLearnerScope } from "../../lib/learningProfile";
import { prisma } from "../../lib/prisma";
import { emitNotification } from "../../lib/realtime";
import { envVars } from "../../config/env";
import { adminCourseSelect } from "../../utils/adminCourseSelect";
import { sendEmailsAsync } from "../../utils/email";
import { logger } from "../../utils/logger";
import { QueryBuilder } from "../../utils/QueryBuilder";

interface CreateNotificationInput {
    userId: string;
    title: string;
    message: string;
    type?: NotificationType;
    link?: string;
    senderId?: string;
    /** Pops up as a SweetAlert the next time this recipient logs in. */
    showOnLogin?: boolean;
    /** Keeps popping up at every login instead of just the next one. */
    repeatOnLogin?: boolean;
    /**
     * Email it too — for what a student would want to know away from the
     * site (a mark, a session moved, a certificate). Skipped for anyone who
     * turned email off in Settings, has no deliverable address, or can't use
     * Half Coders. `actionLabel` is the button, which opens `link`.
     */
    email?: { actionLabel: string };
}

const isAdmin = (role: string) => role === Role.ADMIN || role === Role.SUPER_ADMIN;

/** Opens a screen in the admin console, which only admins can use. */
const opensAdminConsole = (link?: string | null) => Boolean(link && /^\/admin(?:[/?#]|$)/.test(link));

/**
 * Whether someone in this role may be handed this notification at all.
 * Anything that opens the admin console is for admins alone, and payments are
 * for admins and the student who paid — never a mentor, who has no access to
 * either.
 */
const mayReceive = (role: string, input: { type?: NotificationType | null; link?: string | null }) => {
    if (isAdmin(role)) return true;
    if (opensAdminConsole(input.link)) return false;
    return !(role === Role.MENTOR && input.type === NotificationType.PAYMENT);
};

/**
 * The recipients allowed this notification (see `mayReceive`). Roles are
 * only looked up for the kinds some roles mustn't get, so an ordinary
 * notification costs no extra query.
 */
const allowedRecipients = async (userIds: string[], input: { type?: NotificationType; link?: string }) => {
    if (input.type !== NotificationType.PAYMENT && !opensAdminConsole(input.link)) return userIds;
    const users = await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, role: true } });
    return users.filter((user) => mayReceive(user.role, input)).map((user) => user.id);
};

/**
 * The notifications this account sees: its own, less any it may no longer be
 * handed — a student made a mentor keeps their old payment notifications in
 * the table, but not in their bell.
 */
const visibleTo = (user: IRequestUser): Prisma.NotificationWhereInput =>
    isAdmin(user.role)
        ? { userId: user.userId }
        : {
              userId: user.userId,
              NOT: [{ link: { startsWith: "/admin" } }, ...(user.role === Role.MENTOR ? [{ type: NotificationType.PAYMENT }] : [])],
          };

/**
 * The email side of a notification: to each recipient who still wants
 * emails, fire-and-forget, so a slow mail server never holds up the action
 * that notified them.
 */
const emailNotification = async (userIds: string[], input: Omit<CreateNotificationInput, "userId">) => {
    if (!input.email || userIds.length === 0) return;
    try {
        const recipients = await prisma.user.findMany({
            where: {
                id: { in: userIds },
                isDeleted: false,
                status: AccountStatus.ACTIVE,
                NOT: { learningProfile: { status: { in: [LearningStatus.BLOCKED, LearningStatus.DELETED] } } },
            },
            select: { email: true, learningProfile: { select: { preferences: true } } },
        });
        const wanted = recipients.filter(
            (user) =>
                (user.learningProfile?.preferences as { emailPreference?: boolean } | null)?.emailPreference !== false,
        );
        sendEmailsAsync(
            wanted.map((user) => ({
                to: user.email,
                subject: input.title,
                templateName: "notification" as const,
                templateData: {
                    title: input.title,
                    message: input.message,
                    ...(input.link ? { actionUrl: new URL(input.link, envVars.FRONTEND_URL).toString(), actionLabel: input.email?.actionLabel } : {}),
                    settingsUrl: new URL("/settings", envVars.FRONTEND_URL).toString(),
                },
            })),
            "notification email",
        );
    } catch (error) {
        logger.error("Failed to email a notification", error);
    }
};

/**
 * Writes a single in-app notification and, if its owner is connected, pushes
 * it straight to them over the socket — the REST list and unread count stay
 * the source of truth, so a client with no live connection just sees it on
 * its next poll. Deliberately never throws: notifications are a side effect
 * of some other action (an enrolment, a graded assignment), and a failure to
 * notify must not roll that action back. Returns null, writing nothing, for
 * a recipient who mayn't be handed it (see `mayReceive`).
 */
export const createNotification = async (input: CreateNotificationInput) => {
    try {
        const [allowed] = await allowedRecipients([input.userId], input);
        if (!allowed) return null;

        const notification = await prisma.notification.create({
            data: {
                userId: input.userId,
                title: input.title,
                message: input.message,
                type: input.type ?? NotificationType.GENERAL,
                link: input.link,
                senderId: input.senderId,
                showOnLogin: input.showOnLogin ?? false,
                repeatOnLogin: input.repeatOnLogin ?? false,
            },
        });
        emitNotification(input.userId, notification);
        await emailNotification([input.userId], input);
        return notification;
    } catch (error) {
        logger.error("Failed to create notification", error);
        return null;
    }
};

/** Fan-out helper — one row per recipient so read state is per-user. Leaves out anyone who mayn't be handed it. */
export const createNotificationsFor = async (
    recipients: string[],
    input: Omit<CreateNotificationInput, "userId">,
) => {
    if (recipients.length === 0) return 0;

    try {
        const userIds = await allowedRecipients(recipients, input);
        if (userIds.length === 0) return 0;

        const { count } = await prisma.notification.createMany({
            data: userIds.map((userId) => ({
                userId,
                title: input.title,
                message: input.message,
                type: input.type ?? NotificationType.GENERAL,
                link: input.link,
                senderId: input.senderId,
                showOnLogin: input.showOnLogin ?? false,
                repeatOnLogin: input.repeatOnLogin ?? false,
            })),
        });

        // `createMany` doesn't hand back the rows it just wrote, and nothing
        // here needs their ids — the live push is a "go refetch" nudge, not
        // the record itself, so a synthesised payload is enough for every
        // recipient who's connected right now.
        const payload = {
            title: input.title,
            message: input.message,
            type: input.type ?? NotificationType.GENERAL,
            link: input.link ?? null,
            createdAt: new Date().toISOString(),
        };
        for (const userId of userIds) emitNotification(userId, payload);
        await emailNotification(userIds, input);

        return count;
    } catch (error) {
        logger.error("Failed to create bulk notifications", error);
        return 0;
    }
};

/**
 * Tells every admin about something that's an admin's business — a payment
 * landing, a course a student asked for. One row each, like a broadcast, so
 * each admin's read state is their own; `except` leaves out the admin whose
 * own action it was. Never throws, for the same reason `createNotification`
 * doesn't: the sale or the request has already happened.
 */
export const notifyAdmins = async (input: Omit<CreateNotificationInput, "userId">, except?: string) => {
    try {
        const admins = await prisma.user.findMany({
            where: {
                isDeleted: false,
                status: AccountStatus.ACTIVE,
                role: { in: [Role.ADMIN, Role.SUPER_ADMIN] },
                ...(except ? { id: { not: except } } : {}),
            },
            select: { id: true },
        });
        return await createNotificationsFor(
            admins.map((admin) => admin.id),
            input,
        );
    } catch (error) {
        logger.error("Failed to notify admins", error);
        return 0;
    }
};

/**
 * Tells everyone teaching a course about something on it — a hand-in, for
 * now. With `fold`, a mentor who still has an unread notification with the
 * same `link` gets that one rewritten and moved to the top instead of a new
 * row, and the push is marked `silent` (the inbox refreshes, no second
 * toast) — so a class handing in one assignment is a single entry that keeps
 * count, not eighty. Once they've read it, the next one starts a new entry.
 * `except` leaves out whoever caused it. Never throws, like the others.
 */
export const notifyCourseMentors = async (
    courseId: string,
    input: Omit<CreateNotificationInput, "userId">,
    options: { fold?: boolean; except?: string } = {},
) => {
    try {
        const mentors = await prisma.courseMentor.findMany({
            where: {
                courseId,
                mentor: { isDeleted: false, status: AccountStatus.ACTIVE },
                ...(options.except ? { mentorId: { not: options.except } } : {}),
            },
            select: { mentorId: true },
        });

        await Promise.all(
            mentors.map(async ({ mentorId }) => {
                const existing =
                    options.fold && input.link
                        ? await prisma.notification.findFirst({
                            where: { userId: mentorId, link: input.link, isRead: false },
                            orderBy: { createdAt: "desc" },
                            select: { id: true },
                        })
                        : null;
                if (!existing) return createNotification({ ...input, userId: mentorId });

                const notification = await prisma.notification.update({
                    where: { id: existing.id },
                    data: { title: input.title, message: input.message, createdAt: new Date() },
                });
                emitNotification(mentorId, { ...notification, silent: true });
                return notification;
            }),
        );
        return mentors.length;
    } catch (error) {
        logger.error("Failed to notify course mentors", error);
        return 0;
    }
};

const getMyNotifications = async (user: IRequestUser, query: IQueryParams) => {
    return new QueryBuilder(prisma.notification, query, {
        filterableFields: ["type", "isRead"],
        maxLimit: 50,
    })
        .filter()
        .sort()
        .paginate()
        .where(visibleTo(user))
        // Who sent it, where someone did — an announcement reads "From …".
        .include({ sender: { select: { name: true, image: true } } })
        .execute();
};

/** The unread total, and per type — the inbox's filter tabs carry their own counts. */
const getUnreadCount = async (user: IRequestUser) => {
    const groups = await prisma.notification.groupBy({
        by: ["type"],
        where: { ...visibleTo(user), isRead: false },
        _count: { _all: true },
    });
    return {
        count: groups.reduce((sum, group) => sum + group._count._all, 0),
        byType: Object.fromEntries(groups.map((group) => [group.type, group._count._all])) as Partial<Record<NotificationType, number>>,
    };
};

const markAsRead = async (user: IRequestUser, notificationId: string) => {
    // Scoped by userId so one student can't mark another's notification read
    // by guessing an id.
    const { count } = await prisma.notification.updateMany({
        where: { id: notificationId, userId: user.userId, isRead: false },
        data: { isRead: true, readAt: new Date() },
    });

    if (count === 0) {
        const exists = await prisma.notification.findFirst({
            where: { id: notificationId, userId: user.userId },
            select: { id: true },
        });
        if (!exists) throw new AppError(status.NOT_FOUND, "Notification not found.");
    }
};

/** Back to unread — "deal with this later" in the inbox. Scoped like `markAsRead`. */
const markAsUnread = async (user: IRequestUser, notificationId: string) => {
    const { count } = await prisma.notification.updateMany({
        where: { id: notificationId, userId: user.userId },
        data: { isRead: false, readAt: null },
    });
    if (count === 0) throw new AppError(status.NOT_FOUND, "Notification not found.");
};

const markAllAsRead = async (user: IRequestUser) => {
    const { count } = await prisma.notification.updateMany({
        where: { userId: user.userId, isRead: false },
        data: { isRead: true, readAt: new Date() },
    });
    return count;
};

/** Clears out everything this user has already read — the inbox's "Clear read". */
const deleteRead = async (user: IRequestUser) => {
    const { count } = await prisma.notification.deleteMany({ where: { userId: user.userId, isRead: true } });
    return count;
};

const deleteNotification = async (user: IRequestUser, notificationId: string) => {
    const { count } = await prisma.notification.deleteMany({
        where: { id: notificationId, userId: user.userId },
    });
    if (count === 0) throw new AppError(status.NOT_FOUND, "Notification not found.");
};

/**
 * Broadcasts flagged `showOnLogin` that this recipient still has to see —
 * asked for by the client on each page load, right after it recognises who's
 * signed in. Nothing is marked here: the client marks a one-shot pop-up read
 * once the recipient has actually closed it, so one lost to a reload is shown
 * again rather than silently spent. A `repeatOnLogin` pop-up stays unread on
 * purpose; the client shows it once per login session, which `session`
 * names — an opaque digest of the session id, so a new sign-in reads
 * as a new session without the id itself reaching the browser. Either kind
 * stops when the recipient reads it in their bell, or an admin stops it.
 */
const getLoginPopups = async (user: IRequestUser) => {
    const popups = await prisma.notification.findMany({
        where: { ...visibleTo(user), showOnLogin: true, isRead: false },
        orderBy: { createdAt: "asc" },
        take: 10,
        select: { id: true, title: true, message: true, link: true, type: true, repeatOnLogin: true },
    });

    return {
        session: user.sessionId ? createHash("sha256").update(user.sessionId).digest("hex").slice(0, 24) : null,
        popups,
    };
};

/** The fields that make the rows one pop-up broadcast wrote one pop-up, for grouping and for stopping it. */
const POPUP_IDENTITY = ["title", "message", "type", "link", "repeatOnLogin", "senderId"] as const;

const popupKey = (row: Pick<Prisma.NotificationGroupByOutputType, (typeof POPUP_IDENTITY)[number]>) =>
    JSON.stringify(POPUP_IDENTITY.map((field) => row[field]));

/**
 * The Popup Alert screen's list: every pop-up broadcast still flagged to show
 * at login, newest first, with how many it went to and how many have yet to
 * see it (for a repeating one, have yet to read it in their bell). Only admin
 * pop-up broadcasts ever set `showOnLogin`, so its rows are exactly these.
 */
const getLivePopups = async () => {
    const [groups, unseen] = await Promise.all([
        prisma.notification.groupBy({
            by: [...POPUP_IDENTITY],
            where: { showOnLogin: true },
            _count: { _all: true },
            _min: { id: true, createdAt: true },
            orderBy: { _min: { createdAt: "desc" } },
            take: 20,
        }),
        prisma.notification.groupBy({
            by: [...POPUP_IDENTITY],
            where: { showOnLogin: true, isRead: false },
            _count: { _all: true },
        }),
    ]);

    const pending = new Map(unseen.map((row) => [popupKey(row), row._count._all]));

    return groups.map((group) => ({
        // Any row of the group would do as its handle; the earliest is stable.
        id: group._min.id as string,
        title: group.title,
        message: group.message,
        type: group.type,
        link: group.link,
        repeatOnLogin: group.repeatOnLogin,
        sentAt: group._min.createdAt as Date,
        recipients: group._count._all,
        pending: pending.get(popupKey(group)) ?? 0,
    }));
};

/**
 * Stops a pop-up broadcast appearing at login for everyone it went to — the
 * rows the one named by `notificationId` was sent with. They stay in each
 * recipient's bell as an ordinary notification; only the pop-up ends.
 */
const stopPopup = async (notificationId: string) => {
    const anchor = await prisma.notification.findFirst({
        where: { id: notificationId, showOnLogin: true },
        select: { title: true, message: true, type: true, link: true, repeatOnLogin: true, senderId: true },
    });
    if (!anchor) throw new AppError(status.NOT_FOUND, "That pop-up has already been stopped.");

    const { count } = await prisma.notification.updateMany({
        where: { ...anchor, showOnLogin: true },
        data: { showOnLogin: false },
    });

    logger.update("Login pop-up stopped", { title: anchor.title, rows: count });
    return { stopped: count };
};

/**
 * The enrolments a course broadcast reaches. Shared by the send and the
 * composer's live count, so the figure an admin sees before sending is the
 * number of rows the send writes.
 */
const reachableEnrollment = { status: { not: "CANCELLED" } } satisfies Prisma.EnrollmentWhereInput;

/**
 * The broadcast composer's audience: how many each role-wide audience
 * notifies right now, and every live course with its own count. A course
 * nobody has joined yet still lists (with 0), so it isn't mistaken for missing.
 */
const getBroadcastAudience = async () => {
    const [students, mentors, courses, enrolled] = await Promise.all([
        prisma.user.count({ where: activeLearnerScope(Role.STUDENT) }),
        prisma.user.count({ where: activeLearnerScope(Role.MENTOR) }),
        prisma.course.findMany({ where: { isDeleted: false }, select: adminCourseSelect }),
        prisma.enrollment.groupBy({ by: ["courseId"], where: reachableEnrollment, _count: { _all: true } }),
    ]);

    const reach = new Map(enrolled.map((row) => [row.courseId, row._count._all]));

    return {
        students,
        mentors,
        courses: courses
            .map((course) => ({ course, recipients: reach.get(course.id) ?? 0 }))
            .sort((a, b) => b.recipients - a.recipients || a.course.title.localeCompare(b.course.title)),
    };
};

/**
 * Admin broadcast (plan §32). Targets either everyone in a role or everyone
 * enrolled on a given course.
 */
const broadcast = async (
    sender: IRequestUser,
    input: {
        title: string;
        message: string;
        type?: NotificationType;
        link?: string;
        audience: "ALL_STUDENTS" | "ALL_MENTORS" | "COURSE";
        courseId?: string;
        showOnLogin?: boolean;
        repeatOnLogin?: boolean;
    },
) => {
    let userIds: string[];

    if (input.audience === "COURSE") {
        if (!input.courseId) {
            throw new AppError(status.BAD_REQUEST, "Choose a course to notify its students.");
        }
        const enrollments = await prisma.enrollment.findMany({
            where: { courseId: input.courseId, ...reachableEnrollment },
            select: { studentId: true },
        });
        userIds = enrollments.map((e) => e.studentId);
    } else {
        const role = input.audience === "ALL_MENTORS" ? Role.MENTOR : Role.STUDENT;
        const users = await prisma.user.findMany({
            where: activeLearnerScope(role),
            select: { id: true },
        });
        userIds = users.map((u) => u.id);
    }

    const count = await createNotificationsFor(userIds, {
        title: input.title,
        message: input.message,
        type: input.type,
        link: input.link,
        senderId: sender.userId,
        showOnLogin: input.showOnLogin,
        repeatOnLogin: input.repeatOnLogin,
    });

    logger.create("Notification broadcast", { audience: input.audience, recipients: count });
    return { recipients: count };
};

export const NotificationService = {
    createNotification,
    createNotificationsFor,
    getMyNotifications,
    getUnreadCount,
    markAsRead,
    markAsUnread,
    markAllAsRead,
    deleteNotification,
    deleteRead,
    getLoginPopups,
    getLivePopups,
    stopPopup,
    getBroadcastAudience,
    broadcast,
};
