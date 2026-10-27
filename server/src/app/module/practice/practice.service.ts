import status from "http-status";
import { XpSource } from "../../../generated/prisma/enums";
import AppError from "../../errorHelpers/AppError";
import { IRequestUser } from "../../interfaces/requestUser.interface";
import { prisma } from "../../lib/prisma";
import { assertCanManageCourse, requireEnrollment } from "../../utils/courseAccess";
import { logger } from "../../utils/logger";
import { applyOrdering } from "../../utils/ordering";
import {
    applyReleaseRules,
    assertCanSchedule,
    assertPracticeAllowed,
    nextWeekPosition,
    PRACTICE_COURSE_FILTER,
    SCHEDULED_COURSE_FILTER,
} from "../../utils/weekItems";
import { awardXp } from "../leaderboard/leaderboard.service";

/**
 * Practice Day (plan §17) — a hands-on checkpoint inside a milestone. Unlike
 * an assignment there is nothing to hand in and no mentor review; the student
 * marks it done themselves, which is the whole point: it's practice, not
 * assessment. Bootcamp courses only — see `assertPracticeAllowed`.
 */

type CreatePayload = {
    milestoneId: string;
    title: string;
    description?: string;
    instructions?: string;
    order?: number;
    isPublished?: boolean;
    releaseAt?: Date | null;
};

const createPracticeDay = async (user: IRequestUser, payload: CreatePayload) => {
    const milestone = await prisma.milestone.findUnique({
        where: { id: payload.milestoneId },
        select: { id: true, courseId: true },
    });
    if (!milestone) throw new AppError(status.NOT_FOUND, "Milestone not found.");

    await assertCanManageCourse(user, milestone.courseId);
    await assertPracticeAllowed(milestone.courseId);
    logger.create("Creating practice day", { milestoneId: payload.milestoneId });

    await assertCanSchedule(milestone.courseId, payload.releaseAt);
    const { milestoneId, order, ...rest } = applyReleaseRules(payload);

    return prisma.$transaction(async (tx) => {
        const siblings = await tx.practiceDay.findMany({
            where: { milestoneId },
            select: { id: true },
            orderBy: { order: "asc" },
        });

        const position = order ? Math.min(order, siblings.length + 1) : siblings.length + 1;

        const created = await tx.practiceDay.create({
            data: {
                ...rest,
                milestoneId,
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
                tx.practiceDay.update({ where: { id }, data: { order: newOrder } }),
            );
        }

        return tx.practiceDay.findUniqueOrThrow({ where: { id: created.id } });
    });
};

const updatePracticeDay = async (
    user: IRequestUser,
    practiceDayId: string,
    payload: Record<string, unknown>,
) => {
    const practiceDay = await prisma.practiceDay.findUnique({
        where: { id: practiceDayId },
        select: { courseId: true, isPublished: true },
    });
    if (!practiceDay) throw new AppError(status.NOT_FOUND, "Practice day not found.");

    await assertCanManageCourse(user, practiceDay.courseId);
    await assertPracticeAllowed(practiceDay.courseId);
    await assertCanSchedule(practiceDay.courseId, payload.releaseAt as Date | null | undefined);
    applyReleaseRules(payload as { releaseAt?: Date | null; isPublished?: boolean });

    // Stamped once, on the transition into published — see
    // `CourseModule.publishedAt`.
    if (payload.isPublished === true && !practiceDay.isPublished) {
        payload.publishedAt = new Date();
    }

    return prisma.practiceDay.update({ where: { id: practiceDayId }, data: payload });
};

/**
 * The scheduler's job for practice days: publish every one whose `releaseAt`
 * has arrived. The query is its own dedup guard — once published, a row no
 * longer matches.
 */
const publishDuePracticeDays = async () => {
    const due = await prisma.practiceDay.findMany({
        where: { isPublished: false, releaseAt: { lte: new Date() }, ...SCHEDULED_COURSE_FILTER },
        select: { id: true },
    });
    if (due.length === 0) return;

    await prisma.practiceDay.updateMany({
        where: { id: { in: due.map((p) => p.id) } },
        data: { isPublished: true, publishedAt: new Date() },
    });
    logger.create("Auto-published scheduled practice days", { count: due.length });
};

const deletePracticeDay = async (user: IRequestUser, practiceDayId: string) => {
    const practiceDay = await prisma.practiceDay.findUnique({
        where: { id: practiceDayId },
        select: { courseId: true, milestoneId: true },
    });
    if (!practiceDay) throw new AppError(status.NOT_FOUND, "Practice day not found.");

    await assertCanManageCourse(user, practiceDay.courseId);

    await prisma.$transaction(async (tx) => {
        await tx.practiceDay.delete({ where: { id: practiceDayId } });

        const remaining = await tx.practiceDay.findMany({
            where: { milestoneId: practiceDay.milestoneId },
            orderBy: { order: "asc" },
            select: { id: true },
        });

        await applyOrdering(remaining.map((p) => p.id), (id, order) =>
            tx.practiceDay.update({ where: { id }, data: { order } }),
        );
    });
};

const getPracticeDayForStudent = async (user: IRequestUser, practiceDayId: string) => {
    const practiceDay = await prisma.practiceDay.findFirst({
        where: { id: practiceDayId, isPublished: true, ...PRACTICE_COURSE_FILTER },
        include: {
            milestone: { select: { id: true, title: true, order: true } },
            course: { select: { id: true, title: true, slug: true } },
        },
    });
    if (!practiceDay) throw new AppError(status.NOT_FOUND, "Practice day not found.");

    await requireEnrollment(user, practiceDay.courseId);

    const completion = await prisma.practiceCompletion.findUnique({
        where: { practiceDayId_studentId: { practiceDayId, studentId: user.userId } },
    });

    return { ...practiceDay, completion, isCompleted: Boolean(completion) };
};

const markComplete = async (user: IRequestUser, practiceDayId: string, note?: string) => {
    const practiceDay = await prisma.practiceDay.findFirst({
        where: { id: practiceDayId, isPublished: true, ...PRACTICE_COURSE_FILTER },
        select: { id: true, courseId: true },
    });
    if (!practiceDay) throw new AppError(status.NOT_FOUND, "Practice day not found.");

    const enrollment = await requireEnrollment(user, practiceDay.courseId);
    logger.create("Practice day completed", { practiceDayId, studentId: user.userId });

    const completion = await prisma.practiceCompletion.upsert({
        where: { practiceDayId_studentId: { practiceDayId, studentId: user.userId } },
        create: {
            practiceDayId,
            studentId: user.userId,
            enrollmentId: enrollment.id,
            note,
        },
        // Re-marking just refreshes the note; the original completion time
        // stands.
        update: { note },
    });

    await awardXp(prisma, {
        studentId: user.userId,
        courseId: practiceDay.courseId,
        source: XpSource.PRACTICE_COMPLETE,
        refId: practiceDayId,
    });

    return completion;
};

const markIncomplete = async (user: IRequestUser, practiceDayId: string) => {
    const practiceDay = await prisma.practiceDay.findUnique({
        where: { id: practiceDayId },
        select: { courseId: true },
    });
    if (!practiceDay) throw new AppError(status.NOT_FOUND, "Practice day not found.");

    await requireEnrollment(user, practiceDay.courseId);

    // XP already earned stays — the ledger records what happened.
    await prisma.practiceCompletion.deleteMany({
        where: { practiceDayId, studentId: user.userId },
    });
};

export const PracticeService = {
    createPracticeDay,
    updatePracticeDay,
    publishDuePracticeDays,
    deletePracticeDay,
    getPracticeDayForStudent,
    markComplete,
    markIncomplete,
};
