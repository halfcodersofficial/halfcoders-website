import status from "http-status";
import AppError from "../../errorHelpers/AppError";
import { IRequestUser } from "../../interfaces/requestUser.interface";
import { prisma } from "../../lib/prisma";
import { assertCanManageCourse } from "../../utils/courseAccess";
import { assertCurriculumOpen } from "../../utils/coursePhase";
import { logger } from "../../utils/logger";
import { applyOrdering, assertCompleteOrdering } from "../../utils/ordering";
import { scheduleCourseRecalculation } from "../progress/progress.service";

type CreatePayload = {
    courseId: string;
    title: string;
    description?: string;
    order?: number;
    isPublished?: boolean;
};

const createMilestone = async (user: IRequestUser, payload: CreatePayload) => {
    await assertCanManageCourse(user, payload.courseId);
    await assertCurriculumOpen(payload.courseId);
    logger.create("Creating milestone", { courseId: payload.courseId, title: payload.title });

    const { courseId, order, ...rest } = payload;

    const milestoneRow = await prisma.$transaction(async (tx) => {
        const siblings = await tx.milestone.findMany({
            where: { courseId },
            select: { id: true, order: true },
            orderBy: { order: "asc" },
        });

        // Default to appending; an explicit `order` inserts at that position
        // and pushes the rest down.
        const position = order ? Math.min(order, siblings.length + 1) : siblings.length + 1;

        const created = await tx.milestone.create({
            data: {
                ...rest,
                courseId,
                // Park at a free slot past the end, then let applyOrdering put
                // it where it belongs — the unique index rules out inserting
                // directly into an occupied position.
                order: siblings.length + 1,
            },
        });

        if (position <= siblings.length) {
            const ids = siblings.map((s) => s.id);
            ids.splice(position - 1, 0, created.id);
            await applyOrdering(ids, (id, newOrder) =>
                tx.milestone.update({ where: { id }, data: { order: newOrder } }),
            );
        }

        return tx.milestone.findUniqueOrThrow({ where: { id: created.id } });
    });

    if (payload.isPublished) scheduleCourseRecalculation(courseId);

    return milestoneRow;
};

const updateMilestone = async (
    user: IRequestUser,
    milestoneId: string,
    payload: Record<string, unknown>,
) => {
    const milestone = await prisma.milestone.findUnique({
        where: { id: milestoneId },
        select: { courseId: true },
    });
    if (!milestone) throw new AppError(status.NOT_FOUND, "Milestone not found.");

    await assertCanManageCourse(user, milestone.courseId);

    const updated = await prisma.milestone.update({ where: { id: milestoneId }, data: payload });

    if (payload.isPublished !== undefined) scheduleCourseRecalculation(milestone.courseId);

    return updated;
};

const deleteMilestone = async (user: IRequestUser, milestoneId: string) => {
    const milestone = await prisma.milestone.findUnique({
        where: { id: milestoneId },
        select: { courseId: true, order: true },
    });
    if (!milestone) throw new AppError(status.NOT_FOUND, "Milestone not found.");

    await assertCanManageCourse(user, milestone.courseId);
    logger.delete("Deleting milestone", { milestoneId });

    // Cascades to modules, videos, assignments and practice days — and to the
    // progress rows that reference them.
    await prisma.$transaction(async (tx) => {
        await tx.milestone.delete({ where: { id: milestoneId } });

        const remaining = await tx.milestone.findMany({
            where: { courseId: milestone.courseId },
            orderBy: { order: "asc" },
            select: { id: true },
        });

        // Close the gap the deletion left so positions stay 1..n.
        await applyOrdering(remaining.map((m) => m.id), (id, order) =>
            tx.milestone.update({ where: { id }, data: { order } }),
        );
    });

    scheduleCourseRecalculation(milestone.courseId);
};

const reorderMilestones = async (user: IRequestUser, courseId: string, orderedIds: string[]) => {
    await assertCanManageCourse(user, courseId);

    return prisma.$transaction(async (tx) => {
        const existing = await tx.milestone.findMany({
            where: { courseId },
            select: { id: true },
        });

        assertCompleteOrdering(orderedIds, existing.map((m) => m.id));

        await applyOrdering(orderedIds, (id, order) =>
            tx.milestone.update({ where: { id }, data: { order } }),
        );

        return tx.milestone.findMany({ where: { courseId }, orderBy: { order: "asc" } });
    });
};

type WeekItemRef = { kind: "MODULE" | "ASSIGNMENT" | "PRACTICE"; id: string };

/**
 * Reorders a week's one mixed list of modules, assignments and practice days.
 * Stores each item's place in the shared `position`, then re-derives each
 * kind's own `order` from it — module numbering ("01.") and sequential
 * unlocking read `order`, so they follow what was dragged.
 */
const reorderWeekItems = async (user: IRequestUser, milestoneId: string, items: WeekItemRef[]) => {
    const milestone = await prisma.milestone.findUnique({
        where: { id: milestoneId },
        select: { courseId: true },
    });
    if (!milestone) throw new AppError(status.NOT_FOUND, "Milestone not found.");

    await assertCanManageCourse(user, milestone.courseId);

    const idsOf = (kind: WeekItemRef["kind"]) => items.filter((item) => item.kind === kind).map((item) => item.id);

    await prisma.$transaction(async (tx) => {
        const [modules, assignments, practiceDays] = await Promise.all([
            tx.courseModule.findMany({ where: { milestoneId }, select: { id: true } }),
            tx.assignment.findMany({ where: { milestoneId }, select: { id: true } }),
            tx.practiceDay.findMany({ where: { milestoneId }, select: { id: true } }),
        ]);
        assertCompleteOrdering(idsOf("MODULE"), modules.map((m) => m.id));
        assertCompleteOrdering(idsOf("ASSIGNMENT"), assignments.map((a) => a.id));
        assertCompleteOrdering(idsOf("PRACTICE"), practiceDays.map((p) => p.id));

        // The mixed order itself — no unique index on `position`, so one pass.
        for (const [index, item] of items.entries()) {
            const data = { position: index + 1 };
            if (item.kind === "MODULE") await tx.courseModule.update({ where: { id: item.id }, data });
            else if (item.kind === "ASSIGNMENT") await tx.assignment.update({ where: { id: item.id }, data });
            else await tx.practiceDay.update({ where: { id: item.id }, data });
        }

        // Each kind's own order follows it (two-pass, for the unique indexes).
        await applyOrdering(idsOf("MODULE"), (id, order) => tx.courseModule.update({ where: { id }, data: { order } }));
        await applyOrdering(idsOf("ASSIGNMENT"), (id, order) => tx.assignment.update({ where: { id }, data: { order } }));
        await applyOrdering(idsOf("PRACTICE"), (id, order) => tx.practiceDay.update({ where: { id }, data: { order } }));
    },
    // Up to three statements per item — headroom for a busy week.
    { timeout: 20_000, maxWait: 10_000 });
};

/** Curriculum tree for the admin/mentor course editor. */
const getMilestonesByCourse = async (user: IRequestUser, courseId: string) => {
    await assertCanManageCourse(user, courseId);

    return prisma.milestone.findMany({
        where: { courseId },
        orderBy: { order: "asc" },
        include: {
            modules: {
                orderBy: { order: "asc" },
                include: { _count: { select: { videos: true, quizzes: true } } },
            },
            assignments: {
                orderBy: { order: "asc" },
                include: { _count: { select: { materials: true, submissions: true } } },
            },
            practiceDays: { orderBy: { order: "asc" } },
        },
    });
};

export const MilestoneService = {
    createMilestone,
    updateMilestone,
    deleteMilestone,
    reorderMilestones,
    reorderWeekItems,
    getMilestonesByCourse,
};
