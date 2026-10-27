import status from "http-status";
import { CourseMode, NotificationType } from "../../../generated/prisma/enums";
import AppError from "../../errorHelpers/AppError";
import { IRequestUser } from "../../interfaces/requestUser.interface";
import { prisma } from "../../lib/prisma";
import { assertCanManageCourse } from "../../utils/courseAccess";
import { assertCanMarkMode } from "../../utils/courseMode";
import { assertCurriculumOpen } from "../../utils/coursePhase";
import { logger } from "../../utils/logger";
import { applyOrdering, assertCompleteOrdering } from "../../utils/ordering";
import { assertCanSchedule, nextWeekPosition, SCHEDULED_COURSE_FILTER } from "../../utils/weekItems";
import { createNotification } from "../notification/notification.service";
import { scheduleCourseRecalculation } from "../progress/progress.service";

type CreatePayload = {
    milestoneId: string;
    title: string;
    description?: string;
    order?: number;
    isPublished?: boolean;
    releaseAt?: Date | null;
    /** Online or offline — on a course that runs both only. */
    mode?: CourseMode | null;
};

/**
 * A schedule and an immediate publish state can't both be true, and a stale
 * schedule left over from before an unpublish must not resurrect a module on
 * the scheduler's next tick. Enforces two rules, shared by every path that
 * can set `releaseAt`:
 *
 *  1. A `releaseAt` in the payload must be in the future.
 *  2. Providing a real `releaseAt` always forces `isPublished: false` —
 *     "scheduled" and "live now" can't both be true.
 */
const assertValidRelease = (releaseAt: Date | null | undefined) => {
    if (releaseAt && releaseAt.getTime() <= Date.now()) {
        throw new AppError(status.BAD_REQUEST, "Release time must be in the future.");
    }
};

const createModule = async (user: IRequestUser, payload: CreatePayload) => {
    const milestone = await prisma.milestone.findUnique({
        where: { id: payload.milestoneId },
        select: { id: true, courseId: true },
    });
    if (!milestone) throw new AppError(status.NOT_FOUND, "Milestone not found.");

    await assertCanManageCourse(user, milestone.courseId);
    await assertCurriculumOpen(milestone.courseId);
    await assertCanMarkMode(milestone.courseId, payload.mode);
    logger.create("Creating module", { milestoneId: payload.milestoneId, title: payload.title });

    assertValidRelease(payload.releaseAt);
    await assertCanSchedule(milestone.courseId, payload.releaseAt);
    const { milestoneId, order, ...rest } = payload;
    if (rest.releaseAt) rest.isPublished = false;

    const courseModuleRow = await prisma.$transaction(async (tx) => {
        const siblings = await tx.courseModule.findMany({
            where: { milestoneId },
            select: { id: true },
            orderBy: { order: "asc" },
        });

        const position = order ? Math.min(order, siblings.length + 1) : siblings.length + 1;

        const created = await tx.courseModule.create({
            data: {
                ...rest,
                milestoneId,
                // Denormalised so course-wide reads (progress, admin listings)
                // don't need to join through the milestone.
                courseId: milestone.courseId,
                order: siblings.length + 1,
                // Joins the end of the week's mixed list.
                position: await nextWeekPosition(tx, milestoneId),
            },
        });

        if (position <= siblings.length) {
            const ids = siblings.map((s) => s.id);
            ids.splice(position - 1, 0, created.id);
            await applyOrdering(ids, (id, newOrder) =>
                tx.courseModule.update({ where: { id }, data: { order: newOrder } }),
            );
        }

        return tx.courseModule.findUniqueOrThrow({ where: { id: created.id } });
    });

    // A published module (with videos) changes the completion denominator.
    // Reads `rest.isPublished`, not `payload.isPublished` — a contradictory
    // "publish now and schedule for later" payload was just resolved in
    // favour of the schedule above, and the recalculation must agree.
    if (rest.isPublished) scheduleCourseRecalculation(milestone.courseId);

    return courseModuleRow;
};

/**
 * Tells everyone enrolled that a module just opened up (plan §17-ish). Links
 * straight to the module's first published video when it has one — the same
 * `?video=` deep link the player already resolves on load (`learn/[slug]/page.tsx`)
 * — so the notification lands the student inside the module, not just the
 * course root.
 */
const notifyCohort = async (moduleId: string, courseId: string, moduleTitle: string) => {
    const [course, enrollments, firstVideo] = await Promise.all([
        prisma.course.findUnique({ where: { id: courseId }, select: { title: true, slug: true } }),
        prisma.enrollment.findMany({
            where: { courseId, status: { not: "CANCELLED" } },
            select: { studentId: true },
        }),
        prisma.video.findFirst({
            where: { moduleId, isPublished: true },
            orderBy: { order: "asc" },
            select: { id: true },
        }),
    ]);

    if (!course) return;

    const link = firstVideo ? `/learn/${course.slug}?video=${firstVideo.id}` : `/learn/${course.slug}`;

    await Promise.all(
        enrollments.map((enrollment) =>
            createNotification({
                userId: enrollment.studentId,
                title: "New module available",
                message: `"${moduleTitle}" has been published in ${course.title}.`,
                type: NotificationType.MODULE,
                link,
            }),
        ),
    );
};

const updateModule = async (
    user: IRequestUser,
    moduleId: string,
    payload: Record<string, unknown>,
) => {
    const courseModule = await prisma.courseModule.findUnique({
        where: { id: moduleId },
        select: { courseId: true, title: true, isPublished: true },
    });
    if (!courseModule) throw new AppError(status.NOT_FOUND, "Module not found.");

    await assertCanManageCourse(user, courseModule.courseId);
    await assertCanMarkMode(courseModule.courseId, payload.mode as CourseMode | null | undefined);

    const releaseAt = payload.releaseAt as Date | null | undefined;
    assertValidRelease(releaseAt);
    await assertCanSchedule(courseModule.courseId, releaseAt);

    if (releaseAt) {
        // Rule: a real schedule always wins over a publish flag in the same
        // payload — "scheduled" and "live now" can't both be true.
        payload.isPublished = false;
    } else if (releaseAt === undefined && payload.isPublished !== undefined) {
        // Rule: a bare publish/unpublish toggle (no `releaseAt` in this call)
        // clears any existing schedule. Without this, unpublishing a module
        // whose `releaseAt` already passed would leave it indistinguishable
        // from one still waiting to go live, and the scheduler's next tick
        // would silently republish it.
        payload.releaseAt = null;
    }

    // Stamped once, on the transition into published — never overwritten by a
    // later edit or an unpublish/republish, so it stays the outline's "when
    // did this actually go live" date.
    if (payload.isPublished === true && !courseModule.isPublished) {
        payload.publishedAt = new Date();
    }

    const updated = await prisma.courseModule.update({ where: { id: moduleId }, data: payload });

    if (payload.isPublished !== undefined) scheduleCourseRecalculation(courseModule.courseId);

    // Only announce the transition into published, not every later edit —
    // mirrors the same rule for assignments.
    if (payload.isPublished === true && !courseModule.isPublished) {
        void notifyCohort(moduleId, courseModule.courseId, updated.title);
    }

    return updated;
};

/**
 * Auto-publishes every module whose `releaseAt` has arrived. Called from the
 * scheduler poll (`lib/scheduler.ts`) rather than a request handler — the
 * `isPublished: false` guard in the query is what makes this idempotent: a
 * module leaves the matching set the instant this update lands, so a tick
 * that somehow overlapped a previous one (or a human manually publishing the
 * same module a moment earlier) never double-publishes or double-notifies it.
 */
const publishDueModules = async () => {
    const due = await prisma.courseModule.findMany({
        where: { isPublished: false, releaseAt: { lte: new Date() }, ...SCHEDULED_COURSE_FILTER },
        select: { id: true, courseId: true, title: true },
    });
    if (due.length === 0) return;

    const now = new Date();
    await prisma.courseModule.updateMany({
        where: { id: { in: due.map((m) => m.id) } },
        data: { isPublished: true, publishedAt: now },
    });

    logger.create("Auto-published scheduled modules", { count: due.length });

    for (const courseModule of due) {
        scheduleCourseRecalculation(courseModule.courseId);
        void notifyCohort(courseModule.id, courseModule.courseId, courseModule.title);
    }
};

const deleteModule = async (user: IRequestUser, moduleId: string) => {
    const courseModule = await prisma.courseModule.findUnique({
        where: { id: moduleId },
        select: { courseId: true, milestoneId: true },
    });
    if (!courseModule) throw new AppError(status.NOT_FOUND, "Module not found.");

    await assertCanManageCourse(user, courseModule.courseId);
    logger.delete("Deleting module", { moduleId });

    await prisma.$transaction(async (tx) => {
        await tx.courseModule.delete({ where: { id: moduleId } });

        const remaining = await tx.courseModule.findMany({
            where: { milestoneId: courseModule.milestoneId },
            orderBy: { order: "asc" },
            select: { id: true },
        });

        await applyOrdering(remaining.map((m) => m.id), (id, order) =>
            tx.courseModule.update({ where: { id }, data: { order } }),
        );
    });

    scheduleCourseRecalculation(courseModule.courseId);
};

const reorderModules = async (user: IRequestUser, milestoneId: string, orderedIds: string[]) => {
    const milestone = await prisma.milestone.findUnique({
        where: { id: milestoneId },
        select: { courseId: true },
    });
    if (!milestone) throw new AppError(status.NOT_FOUND, "Milestone not found.");

    await assertCanManageCourse(user, milestone.courseId);

    return prisma.$transaction(async (tx) => {
        const existing = await tx.courseModule.findMany({
            where: { milestoneId },
            select: { id: true },
        });

        assertCompleteOrdering(orderedIds, existing.map((m) => m.id));

        await applyOrdering(orderedIds, (id, order) =>
            tx.courseModule.update({ where: { id }, data: { order } }),
        );

        return tx.courseModule.findMany({ where: { milestoneId }, orderBy: { order: "asc" } });
    });
};

const getModulesByMilestone = async (user: IRequestUser, milestoneId: string) => {
    const milestone = await prisma.milestone.findUnique({
        where: { id: milestoneId },
        select: { courseId: true },
    });
    if (!milestone) throw new AppError(status.NOT_FOUND, "Milestone not found.");

    await assertCanManageCourse(user, milestone.courseId);

    return prisma.courseModule.findMany({
        where: { milestoneId },
        orderBy: { order: "asc" },
        include: { videos: { orderBy: { order: "asc" } } },
    });
};

export const CourseModuleService = {
    createModule,
    updateModule,
    deleteModule,
    reorderModules,
    getModulesByMilestone,
    publishDueModules,
};
