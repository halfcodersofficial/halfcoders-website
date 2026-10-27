import status from "http-status";
import { Prisma } from "../../generated/prisma/client";
import { CourseMode } from "../../generated/prisma/enums";
import AppError from "../errorHelpers/AppError";
import { prisma } from "../lib/prisma";

/**
 * A course runs online, offline, or both. Only a course that runs both says,
 * module by module and outline item by outline item, which of the two each
 * one is; every other course's items follow the course and store no mode.
 */

/** The two places a single class can happen — what an item is marked with. */
export const CLASS_MODES = [CourseMode.ONLINE, CourseMode.OFFLINE] as const;

/** An offline course, or one that's partly offline, may name its venue. */
export const hasVenue = (mode: CourseMode | null | undefined) =>
    mode === CourseMode.OFFLINE || mode === CourseMode.BOTH;

/** Marking a module or outline item online or offline: only on a course that runs both. */
export const assertCanMarkMode = async (courseId: string, mode: CourseMode | null | undefined) => {
    if (!mode) return;
    const course = await prisma.course.findUnique({ where: { id: courseId }, select: { mode: true } });
    if (course?.mode !== CourseMode.BOTH) {
        throw new AppError(
            status.BAD_REQUEST,
            "Only a course that runs both online and offline marks each module online or offline. Change the course's delivery mode first.",
        );
    }
};

/**
 * A course that stops running both has no use for its items' marks — they'd
 * say "offline" on a course that's online only. Cleared in the course's own
 * save, the way `venue` is.
 */
export const clearItemModes = async (tx: Prisma.TransactionClient, courseId: string) => {
    const marked = { courseId, mode: { not: null } };
    await tx.courseModule.updateMany({ where: marked, data: { mode: null } });
    await tx.outlineItem.updateMany({ where: marked, data: { mode: null } });
};

/**
 * The catalogue's `?mode=`: a course that runs both is an online course and
 * an offline one too, so it lists under either. `?mode=BOTH` stays exact.
 */
export const withBothModes = <Q extends Record<string, unknown>>(query: Q): Q =>
    query.mode === CourseMode.ONLINE || query.mode === CourseMode.OFFLINE
        ? { ...query, mode: [query.mode, CourseMode.BOTH] }
        : query;
