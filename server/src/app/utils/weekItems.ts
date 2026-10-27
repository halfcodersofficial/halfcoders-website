import status from "http-status";
import { Prisma } from "../../generated/prisma/client";
import { CourseType } from "../../generated/prisma/enums";
import AppError from "../errorHelpers/AppError";
import { prisma } from "../lib/prisma";

/**
 * A week's modules, assignments and practice days share one `position`
 * sequence, so they can be interleaved in a single list (see
 * `CourseModule.position`). These helpers keep new items and scheduled
 * releases consistent across the three kinds — and scheduling itself to
 * bootcamp courses.
 */

/** The next free place at the end of a week's mixed list — where a new item lands. */
export const nextWeekPosition = async (tx: Prisma.TransactionClient, milestoneId: string) => {
    const [modules, assignments, practiceDays] = await Promise.all([
        tx.courseModule.aggregate({ where: { milestoneId }, _max: { position: true } }),
        tx.assignment.aggregate({ where: { milestoneId }, _max: { position: true } }),
        tx.practiceDay.aggregate({ where: { milestoneId }, _max: { position: true } }),
    ]);
    return (
        Math.max(
            modules._max.position ?? 0,
            assignments._max.position ?? 0,
            practiceDays._max.position ?? 0,
        ) + 1
    );
};

/**
 * The release rules modules already follow, shared by assignments and
 * practice days: a schedule must be in the future, and setting one takes the
 * item off-air until it arrives; a bare publish/unpublish clears any
 * schedule, so an unpublished item can't be resurrected by a stale one.
 * Mutates and returns `payload`.
 */
export const applyReleaseRules = <T extends { releaseAt?: Date | null; isPublished?: boolean }>(payload: T): T => {
    if (payload.releaseAt && payload.releaseAt.getTime() <= Date.now()) {
        throw new AppError(status.BAD_REQUEST, "Release time must be in the future.");
    }
    if (payload.releaseAt) {
        payload.isPublished = false;
    } else if (payload.releaseAt === undefined && payload.isPublished !== undefined) {
        payload.releaseAt = null;
    }
    return payload;
};

/**
 * Scheduling is a bootcamp idea. A traditional course is self-paced, so its
 * modules, assignments and practice days are only ever published or
 * unpublished, right away — a real `releaseAt` for one is refused.
 */
export const assertCanSchedule = async (courseId: string, releaseAt: Date | null | undefined) => {
    if (!releaseAt) return;
    const course = await prisma.course.findUnique({ where: { id: courseId }, select: { courseType: true } });
    if (course?.courseType !== CourseType.BOOTCAMP) {
        throw new AppError(
            status.BAD_REQUEST,
            "Only bootcamp courses can schedule a release. A traditional course publishes right away.",
        );
    }
};

/**
 * Practice days are a bootcamp idea too — a traditional course is modules
 * only. One left over from when the course was a bootcamp is kept, for staff
 * to remove, but can't be edited and never reaches a student.
 */
export const assertPracticeAllowed = async (courseId: string) => {
    const course = await prisma.course.findUnique({ where: { id: courseId }, select: { courseType: true } });
    if (course?.courseType !== CourseType.BOOTCAMP) {
        throw new AppError(
            status.BAD_REQUEST,
            "Practice days are for bootcamp courses. A traditional course can only remove one left over.",
        );
    }
};

/** The student-side filter for practice days: a bootcamp course's only. */
export const PRACTICE_COURSE_FILTER = { course: { courseType: CourseType.BOOTCAMP } } as const;

/**
 * The scheduler's filter: only a bootcamp course's schedules ever fire. A
 * course switched to traditional has its pending ones cleared (see
 * `CourseService.updateCourse`); this is the backstop.
 */
export const SCHEDULED_COURSE_FILTER = { course: { courseType: CourseType.BOOTCAMP } } as const;
