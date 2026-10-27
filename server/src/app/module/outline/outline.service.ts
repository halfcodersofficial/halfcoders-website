import status from "http-status";
import { Prisma } from "../../../generated/prisma/client";
import { CourseMode, CourseType, OutlineItemKind } from "../../../generated/prisma/enums";
import AppError from "../../errorHelpers/AppError";
import { IRequestUser } from "../../interfaces/requestUser.interface";
import { prisma } from "../../lib/prisma";
import { assertCanManageCourse } from "../../utils/courseAccess";
import { assertCanMarkMode } from "../../utils/courseMode";
import { assertCurriculumOpen } from "../../utils/coursePhase";
import { logger } from "../../utils/logger";
import { applyOrdering, assertCompleteOrdering } from "../../utils/ordering";

/**
 * The Outline Maker — the planned schedule students read after enrolling.
 *
 * Nothing in this file touches `Milestone`, `CourseModule` or their publish
 * state, and nothing there touches this. The one bridge is
 * `copyFromModules`, an explicit, one-time snapshot an admin can ask for to
 * start an empty outline; after that the two drift apart freely.
 */

/**
 * A bootcamp outline is dated: items run in date order, undated ("to be
 * announced") ones last. A traditional outline has no dates, so it runs in
 * the order staff dragged it into.
 */
const itemOrder = (courseType: CourseType) =>
    (courseType === CourseType.BOOTCAMP
        ? [{ scheduledAt: { sort: "asc", nulls: "last" } }, { position: "asc" }, { createdAt: "asc" }]
        : [{ position: "asc" }, { createdAt: "asc" }]) satisfies Prisma.OutlineItemOrderByWithRelationInput[];

/** No-module days and practice days — the kinds a traditional outline can't hold. */
const BOOTCAMP_ONLY_KINDS: OutlineItemKind[] = [OutlineItemKind.NO_MODULE, OutlineItemKind.PRACTICE];

/**
 * One week with its items. `publishedOnly` is the student view of a
 * traditional course, where an item shows only once it's published by hand —
 * and never a no-module or practice day, which are bootcamp things (one left
 * over from when the course was a bootcamp stays in the editor, but not here).
 */
export const outlineWeekSelect = (courseType: CourseType, publishedOnly = false) =>
    ({
        id: true,
        title: true,
        order: true,
        items: {
            where: publishedOnly ? { isPublished: true, kind: { notIn: BOOTCAMP_ONLY_KINDS } } : undefined,
            orderBy: itemOrder(courseType),
            select: { id: true, kind: true, title: true, note: true, scheduledAt: true, isPublished: true, mode: true },
        },
    }) satisfies Prisma.OutlineWeekSelect;

const courseTypeOf = async (courseId: string) => {
    const course = await prisma.course.findUnique({ where: { id: courseId }, select: { courseType: true } });
    if (!course) throw new AppError(status.NOT_FOUND, "Course not found.");
    return course.courseType;
};

const listWeeks = async (courseId: string) =>
    prisma.outlineWeek.findMany({
        where: { courseId },
        orderBy: { order: "asc" },
        select: outlineWeekSelect(await courseTypeOf(courseId)),
    });

const loadWeekForWrite = async (user: IRequestUser, weekId: string) => {
    const week = await prisma.outlineWeek.findUnique({
        where: { id: weekId },
        select: { id: true, courseId: true, course: { select: { courseType: true } } },
    });
    if (!week) throw new AppError(status.NOT_FOUND, "Week not found.");

    await assertCanManageCourse(user, week.courseId);
    return { id: week.id, courseId: week.courseId, courseType: week.course.courseType };
};

/** The place after a week's last item — where a new or moved-in item lands. */
const nextItemPosition = async (weekId: string) => {
    const last = await prisma.outlineItem.aggregate({ where: { weekId }, _max: { position: true } });
    return (last._max.position ?? 0) + 1;
};

/**
 * Dates, no-module days and practice days are a bootcamp thing and the
 * publish switch a traditional one — each course type refuses the other's field rather than
 * quietly storing a value nothing would ever read.
 */
const assertFitsCourseType = (
    courseType: CourseType,
    payload: { kind?: OutlineItemKind; scheduledAt?: Date | null; isPublished?: boolean },
) => {
    if (courseType === CourseType.TRADITIONAL && payload.scheduledAt) {
        throw new AppError(
            status.BAD_REQUEST,
            "A traditional course's outline has no dates — publish or unpublish the item instead.",
        );
    }
    if (courseType === CourseType.TRADITIONAL && payload.kind && BOOTCAMP_ONLY_KINDS.includes(payload.kind)) {
        throw new AppError(
            status.BAD_REQUEST,
            "No-module days and practice days are for bootcamp courses — a traditional outline has modules only.",
        );
    }
    if (courseType === CourseType.BOOTCAMP && payload.isPublished !== undefined) {
        throw new AppError(
            status.BAD_REQUEST,
            "A bootcamp outline item shows as published once its planned time passes — set its date instead.",
        );
    }
};

const getOutline = async (user: IRequestUser, courseId: string) => {
    await assertCanManageCourse(user, courseId);
    return listWeeks(courseId);
};

const createWeek = async (user: IRequestUser, payload: { courseId: string; title?: string | null }) => {
    await assertCanManageCourse(user, payload.courseId);
    // An upcoming course has no running outline yet — nor any weeks for items to go in.
    await assertCurriculumOpen(payload.courseId);

    // Appended, so the next position is simply one past the current count —
    // positions are kept gap-free by delete and reorder below.
    const select = outlineWeekSelect(await courseTypeOf(payload.courseId));
    return prisma.$transaction(async (tx) => {
        const count = await tx.outlineWeek.count({ where: { courseId: payload.courseId } });
        return tx.outlineWeek.create({
            data: { courseId: payload.courseId, title: payload.title ?? null, order: count + 1 },
            select,
        });
    });
};

const updateWeek = async (user: IRequestUser, weekId: string, payload: { title?: string | null }) => {
    const week = await loadWeekForWrite(user, weekId);
    return prisma.outlineWeek.update({
        where: { id: weekId },
        data: { title: payload.title },
        select: outlineWeekSelect(week.courseType),
    });
};

const deleteWeek = async (user: IRequestUser, weekId: string) => {
    const week = await loadWeekForWrite(user, weekId);
    logger.delete("Deleting outline week", { weekId });

    // Cascades to the week's items.
    await prisma.$transaction(async (tx) => {
        await tx.outlineWeek.delete({ where: { id: weekId } });

        const remaining = await tx.outlineWeek.findMany({
            where: { courseId: week.courseId },
            orderBy: { order: "asc" },
            select: { id: true },
        });

        await applyOrdering(remaining.map((w) => w.id), (id, order) =>
            tx.outlineWeek.update({ where: { id }, data: { order } }),
        );
    });
};

const reorderWeeks = async (user: IRequestUser, courseId: string, orderedIds: string[]) => {
    await assertCanManageCourse(user, courseId);

    await prisma.$transaction(async (tx) => {
        const existing = await tx.outlineWeek.findMany({ where: { courseId }, select: { id: true } });
        assertCompleteOrdering(orderedIds, existing.map((w) => w.id));

        await applyOrdering(orderedIds, (id, order) =>
            tx.outlineWeek.update({ where: { id }, data: { order } }),
        );
    });

    return listWeeks(courseId);
};

type ItemPayload = {
    kind: OutlineItemKind;
    title: string;
    note?: string | null;
    /** Bootcamp only. */
    scheduledAt?: Date | null;
    /** Traditional only. */
    isPublished?: boolean;
    /** Online or offline — on a course that runs both only. */
    mode?: CourseMode | null;
};

const createItem = async (user: IRequestUser, payload: ItemPayload & { weekId: string }) => {
    const week = await loadWeekForWrite(user, payload.weekId);
    assertFitsCourseType(week.courseType, payload);
    await assertCanMarkMode(week.courseId, payload.mode);

    return prisma.outlineItem.create({
        data: {
            weekId: week.id,
            courseId: week.courseId,
            kind: payload.kind,
            title: payload.title,
            note: payload.note ?? null,
            scheduledAt: payload.scheduledAt ?? null,
            isPublished: payload.isPublished ?? false,
            // A day with no module has no class to hold anywhere.
            mode: payload.kind === OutlineItemKind.NO_MODULE ? null : (payload.mode ?? null),
            position: await nextItemPosition(week.id),
        },
    });
};

const loadItemForWrite = async (user: IRequestUser, itemId: string) => {
    const item = await prisma.outlineItem.findUnique({
        where: { id: itemId },
        select: { id: true, courseId: true, weekId: true, kind: true, course: { select: { courseType: true } } },
    });
    if (!item) throw new AppError(status.NOT_FOUND, "Outline item not found.");

    await assertCanManageCourse(user, item.courseId);
    return { id: item.id, courseId: item.courseId, weekId: item.weekId, kind: item.kind, courseType: item.course.courseType };
};

const updateItem = async (user: IRequestUser, itemId: string, payload: Partial<ItemPayload> & { weekId?: string }) => {
    const item = await loadItemForWrite(user, itemId);
    assertFitsCourseType(item.courseType, payload);
    await assertCanMarkMode(item.courseId, payload.mode);
    const isGap = (payload.kind ?? item.kind) === OutlineItemKind.NO_MODULE;

    // Moving between weeks is allowed, but only within the same course — a
    // week id from another course would otherwise re-home the row there.
    const isMoving = Boolean(payload.weekId) && payload.weekId !== item.weekId;
    if (isMoving) {
        const target = await prisma.outlineWeek.findUnique({
            where: { id: payload.weekId },
            select: { courseId: true },
        });
        if (!target || target.courseId !== item.courseId) {
            throw new AppError(status.BAD_REQUEST, "That week isn't part of this course's outline.");
        }
    }

    return prisma.outlineItem.update({
        where: { id: itemId },
        data: {
            weekId: payload.weekId,
            kind: payload.kind,
            title: payload.title,
            note: payload.note,
            scheduledAt: payload.scheduledAt,
            isPublished: payload.isPublished,
            mode: isGap ? null : payload.mode,
            // A moved item joins the end of its new week.
            position: isMoving ? await nextItemPosition(payload.weekId!) : undefined,
        },
    });
};

/**
 * A traditional outline is simply listed in the new order. A bootcamp one is
 * listed by date, so "move this one up" can only mean "give it an earlier
 * slot": the week's dates stay exactly where they are and the items are dealt
 * back into them in the new order — drag Monday's module below Tuesday's and
 * the two swap days. Undated items keep no date; their slots are the null
 * ones at the end. Either way `position` follows, so a later switch of course
 * type starts from the same order.
 */
const reorderItems = async (user: IRequestUser, weekId: string, orderedIds: string[]) => {
    const week = await loadWeekForWrite(user, weekId);

    await prisma.$transaction(async (tx) => {
        const items = await tx.outlineItem.findMany({
            where: { weekId },
            orderBy: itemOrder(week.courseType),
            select: { id: true, scheduledAt: true },
        });
        assertCompleteOrdering(orderedIds, items.map((item) => item.id));

        const slots = items.map((item) => item.scheduledAt);
        for (const [index, id] of orderedIds.entries()) {
            await tx.outlineItem.update({
                where: { id },
                data: {
                    position: index + 1,
                    ...(week.courseType === CourseType.BOOTCAMP ? { scheduledAt: slots[index] } : {}),
                },
            });
        }
    },
    // One statement per item — headroom for a busy week.
    { timeout: 20_000, maxWait: 10_000 });

    return listWeeks(week.courseId);
};

const deleteItem = async (user: IRequestUser, itemId: string) => {
    await loadItemForWrite(user, itemId);
    await prisma.outlineItem.delete({ where: { id: itemId } });
};

/**
 * Publishes every draft in a traditional outline at once — or, given a week,
 * just that week's. A bootcamp outline has no publish switch to flip.
 */
const publishAll = async (user: IRequestUser, courseId: string, payload: { weekId?: string }) => {
    await assertCanManageCourse(user, courseId);
    if ((await courseTypeOf(courseId)) === CourseType.BOOTCAMP) {
        throw new AppError(
            status.BAD_REQUEST,
            "A bootcamp outline item shows as published once its planned time passes — set its date instead.",
        );
    }

    if (payload.weekId) {
        const week = await prisma.outlineWeek.findUnique({ where: { id: payload.weekId }, select: { courseId: true } });
        if (!week || week.courseId !== courseId) {
            throw new AppError(status.BAD_REQUEST, "That week isn't part of this course's outline.");
        }
    }

    // A leftover no-module or practice day is never shown to students, so it isn't a draft.
    const { count } = await prisma.outlineItem.updateMany({
        where: { courseId, weekId: payload.weekId, isPublished: false, kind: { notIn: BOOTCAMP_ONLY_KINDS } },
        data: { isPublished: true },
    });
    return { count };
};

/**
 * A one-time starting point for an empty outline: one week per milestone, one
 * item per module and (bootcamp only) practice day. A bootcamp copy is dated from each one's
 * release (or publish) time where it has one; a traditional copy is undated
 * and takes each one's published state instead. A module's online/offline
 * mark comes along too. A copy, not a link — editing
 * either side afterwards never touches the other, which is why it refuses to
 * run on an outline that already has weeks rather than merging into it.
 */
const copyFromModules = async (user: IRequestUser, courseId: string) => {
    await assertCanManageCourse(user, courseId);
    await assertCurriculumOpen(courseId);
    const isBootcamp = (await courseTypeOf(courseId)) === CourseType.BOOTCAMP;

    const existing = await prisma.outlineWeek.count({ where: { courseId } });
    if (existing > 0) {
        throw new AppError(
            status.CONFLICT,
            "This outline already has weeks. Copying is only for starting an empty outline.",
        );
    }

    const milestones = await prisma.milestone.findMany({
        where: { courseId },
        orderBy: { order: "asc" },
        select: {
            title: true,
            modules: {
                orderBy: { order: "asc" },
                select: { title: true, position: true, isPublished: true, releaseAt: true, publishedAt: true, mode: true },
            },
            practiceDays: {
                orderBy: { order: "asc" },
                select: { title: true, position: true, isPublished: true, releaseAt: true, publishedAt: true },
            },
        },
    });
    if (milestones.length === 0) {
        throw new AppError(status.BAD_REQUEST, "The Module Manager has no weeks to copy yet.");
    }

    await prisma.$transaction(async (tx) => {
        for (const [index, milestone] of milestones.entries()) {
            // In the week's own mixed order, modules and practice days together.
            const entries = [
                ...milestone.modules.map((entry) => ({ kind: OutlineItemKind.MODULE, ...entry })),
                ...(isBootcamp
                    ? milestone.practiceDays.map((entry) => ({ kind: OutlineItemKind.PRACTICE, ...entry, mode: null }))
                    : []),
            ].sort((a, b) => a.position - b.position);

            await tx.outlineWeek.create({
                data: {
                    courseId,
                    title: milestone.title,
                    order: index + 1,
                    items: {
                        create: entries.map((entry, itemIndex) => ({
                            courseId,
                            kind: entry.kind,
                            title: entry.title,
                            position: itemIndex + 1,
                            scheduledAt: isBootcamp ? (entry.releaseAt ?? entry.publishedAt) : null,
                            isPublished: isBootcamp ? false : entry.isPublished,
                            mode: entry.mode,
                        })),
                    },
                },
            });
        }
    },
    { timeout: 20_000, maxWait: 10_000 });

    logger.create("Outline copied from modules", { courseId, weeks: milestones.length });
    return listWeeks(courseId);
};

export const OutlineService = {
    getOutline,
    createWeek,
    updateWeek,
    deleteWeek,
    reorderWeeks,
    createItem,
    updateItem,
    reorderItems,
    deleteItem,
    publishAll,
    copyFromModules,
};
