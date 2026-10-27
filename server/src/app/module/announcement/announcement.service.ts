import status from "http-status";
import { NotificationType } from "../../../generated/prisma/enums";
import AppError from "../../errorHelpers/AppError";
import { IRequestUser } from "../../interfaces/requestUser.interface";
import { prisma } from "../../lib/prisma";
import { Role } from "../../lib/roles";
import { assertCanManageCourse, requireCourseAccess } from "../../utils/courseAccess";
import { createNotificationsFor } from "../notification/notification.service";

/** Who posted it: a name and whether they teach the course or run the platform — staff, never students. */
const authorSelect = { id: true, name: true, image: true } as const;

/**
 * A course's notice board, pinned posts first, then newest. Its staff and
 * the students who can open the course read it — the same gate as the
 * course's lessons.
 */
const listForCourse = async (user: IRequestUser, courseId: string) => {
    if (user.role === Role.STUDENT) await requireCourseAccess(user, courseId);
    else await assertCanManageCourse(user, courseId);

    return prisma.courseAnnouncement.findMany({
        where: { courseId },
        orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
        take: 100,
        include: { author: { select: authorSelect } },
    });
};

/** The same board, found by the course's slug — how a student's page addresses it. */
const listForCourseSlug = async (user: IRequestUser, slug: string) => {
    const course = await prisma.course.findFirst({ where: { slug, isDeleted: false }, select: { id: true, title: true, slug: true } });
    if (!course) throw new AppError(status.NOT_FOUND, "Course not found.");
    return { course, announcements: await listForCourse(user, course.id) };
};

/**
 * Posts to everyone on the course: it goes on the board, and each student who
 * can still open the course is notified (and emailed, if they want emails).
 */
const create = async (user: IRequestUser, courseId: string, payload: { title: string; body: string; isPinned?: boolean }) => {
    await assertCanManageCourse(user, courseId);
    const course = await prisma.course.findUniqueOrThrow({ where: { id: courseId }, select: { slug: true, title: true } });

    const announcement = await prisma.courseAnnouncement.create({
        data: { courseId, authorId: user.userId, title: payload.title, body: payload.body, isPinned: payload.isPinned ?? false },
        include: { author: { select: authorSelect } },
    });

    const enrollments = await prisma.enrollment.findMany({
        where: { courseId, status: { not: "CANCELLED" } },
        select: { studentId: true },
    });
    const preview = payload.body.length > 280 ? `${payload.body.slice(0, 277)}…` : payload.body;
    const recipients = await createNotificationsFor(
        enrollments.map((enrollment) => enrollment.studentId),
        {
            title: `${course.title}: ${payload.title}`,
            message: preview,
            type: NotificationType.COURSE,
            link: `/learn/${course.slug}/announcements#${announcement.id}`,
            senderId: user.userId,
            email: { actionLabel: "Read it on Half Coders" },
        },
    );

    return { ...announcement, recipients };
};

/**
 * The post, for a change: the course's staff may edit or pin any post on
 * it — a co-mentor can fix a colleague's typo — but nobody is notified again.
 */
const loadForChange = async (user: IRequestUser, announcementId: string) => {
    const announcement = await prisma.courseAnnouncement.findUnique({ where: { id: announcementId }, select: { id: true, courseId: true } });
    if (!announcement) throw new AppError(status.NOT_FOUND, "Announcement not found.");
    await assertCanManageCourse(user, announcement.courseId);
    return announcement;
};

const update = async (user: IRequestUser, announcementId: string, payload: { title?: string; body?: string; isPinned?: boolean }) => {
    await loadForChange(user, announcementId);
    return prisma.courseAnnouncement.update({
        where: { id: announcementId },
        data: payload,
        include: { author: { select: authorSelect } },
    });
};

const remove = async (user: IRequestUser, announcementId: string) => {
    await loadForChange(user, announcementId);
    await prisma.courseAnnouncement.delete({ where: { id: announcementId } });
};

export const AnnouncementService = { listForCourse, listForCourseSlug, create, update, remove };
