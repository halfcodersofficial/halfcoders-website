import status from "http-status";
import { EnrollmentStatus, RewardCondition, XpSource } from "../../../generated/prisma/enums";
import AppError from "../../errorHelpers/AppError";
import { IRequestUser } from "../../interfaces/requestUser.interface";
import { prisma } from "../../lib/prisma";
import { assertModuleUnlocked, requireEnrollment } from "../../utils/courseAccess";
import { grantCompletionReward, rewardMainCourse } from "../../utils/courseGrants";
import { logger } from "../../utils/logger";
import { awardXp } from "../leaderboard/leaderboard.service";

const percent = (done: number, total: number) => (total === 0 ? 0 : Math.round((done / total) * 100));

interface ModuleState {
    moduleId: string;
    completedVideos: number;
    totalVideos: number;
    progress: number;
    isCompleted: boolean;
}

interface MilestoneState {
    milestoneId: string;
    completedModules: number;
    totalModules: number;
    progress: number;
    isCompleted: boolean;
}

export interface RecalculationResult {
    progress: number;
    newlyCompletedModuleIds: string[];
    newlyCompletedMilestoneIds: string[];
    courseJustCompleted: boolean;
}

/**
 * Rebuilds the progress chain for one enrollment from the underlying
 * VideoProgress rows: module → milestone → course (plan §13).
 *
 * Recomputing from source rather than incrementing counters keeps the numbers
 * honest when the curriculum changes underneath a student — a mentor
 * publishing a new video lowers everyone's percentage the next time this runs,
 * which is the correct answer.
 *
 * Structure matters here. Every read happens *outside* a transaction and the
 * writes are batched down to only the rows whose values actually changed. An
 * earlier version recomputed and rewrote all 40 modules inside one interactive
 * transaction, which blew Prisma's 5s ceiling against a remote database (P2028)
 * — each upsert is a separate network round trip, so the work grew linearly
 * with course size and failed on exactly the large courses the plan describes.
 * In steady state only one module and at most one milestone change, so the
 * transaction is now a handful of statements regardless of course length.
 */
const recalculateProgress = async (enrollmentId: string): Promise<RecalculationResult> => {
    const enrollment = await prisma.enrollment.findUniqueOrThrow({
        where: { id: enrollmentId },
        select: { id: true, studentId: true, courseId: true, status: true, completedAt: true },
    });

    // ---- Reads: the whole published curriculum plus what's already recorded.
    const [milestones, completedVideos, existingModuleRows, existingMilestoneRows] = await Promise.all([
        prisma.milestone.findMany({
            where: { courseId: enrollment.courseId, isPublished: true },
            orderBy: { order: "asc" },
            select: {
                id: true,
                modules: {
                    where: { isPublished: true },
                    orderBy: { order: "asc" },
                    select: {
                        id: true,
                        videos: {
                            where: { isPublished: true },
                            orderBy: { order: "asc" },
                            select: { id: true },
                        },
                    },
                },
            },
        }),
        prisma.videoProgress.findMany({
            where: { enrollmentId, isCompleted: true },
            select: { videoId: true },
        }),
        prisma.moduleProgress.findMany({ where: { enrollmentId } }),
        prisma.milestoneProgress.findMany({ where: { enrollmentId } }),
    ]);

    const completedVideoIds = new Set(completedVideos.map((row) => row.videoId));
    const existingModules = new Map(existingModuleRows.map((row) => [row.moduleId, row]));
    const existingMilestones = new Map(existingMilestoneRows.map((row) => [row.milestoneId, row]));

    // ---- Compute the desired state in memory.
    const moduleStates: ModuleState[] = [];
    const milestoneStates: MilestoneState[] = [];
    const newlyCompletedModuleIds: string[] = [];
    const newlyCompletedMilestoneIds: string[] = [];

    let courseTotalVideos = 0;
    let courseCompletedVideos = 0;
    let currentModuleId: string | null = null;
    let currentMilestoneId: string | null = null;

    for (const milestone of milestones) {
        let milestoneCompletedModules = 0;

        for (const courseModule of milestone.modules) {
            const totalVideos = courseModule.videos.length;
            const completed = courseModule.videos.filter((v) => completedVideoIds.has(v.id)).length;

            courseTotalVideos += totalVideos;
            courseCompletedVideos += completed;

            // A module with no published videos is empty, not finished —
            // treating it as done would let a student complete a course that
            // has no content in it.
            const isCompleted = totalVideos > 0 && completed === totalVideos;
            if (isCompleted) milestoneCompletedModules += 1;

            if (isCompleted && existingModules.get(courseModule.id)?.isCompleted !== true) {
                newlyCompletedModuleIds.push(courseModule.id);
            }

            // The first unfinished module in curriculum order is where
            // "Continue Learning" should drop the student.
            if (!isCompleted && currentModuleId === null) {
                currentModuleId = courseModule.id;
                currentMilestoneId = milestone.id;
            }

            moduleStates.push({
                moduleId: courseModule.id,
                completedVideos: completed,
                totalVideos,
                progress: percent(completed, totalVideos),
                isCompleted,
            });
        }

        const totalModules = milestone.modules.length;
        const isCompleted = totalModules > 0 && milestoneCompletedModules === totalModules;

        if (isCompleted && existingMilestones.get(milestone.id)?.isCompleted !== true) {
            newlyCompletedMilestoneIds.push(milestone.id);
        }

        milestoneStates.push({
            milestoneId: milestone.id,
            completedModules: milestoneCompletedModules,
            totalModules,
            progress: percent(milestoneCompletedModules, totalModules),
            isCompleted,
        });
    }

    const progress = percent(courseCompletedVideos, courseTotalVideos);
    const isCourseComplete = courseTotalVideos > 0 && courseCompletedVideos === courseTotalVideos;
    const courseJustCompleted = isCourseComplete && enrollment.completedAt === null;
    const now = new Date();

    // ---- Diff: only touch rows that are missing or actually changed.
    const modulesToCreate = moduleStates.filter((s) => !existingModules.has(s.moduleId));
    const modulesToUpdate = moduleStates.filter((s) => {
        const row = existingModules.get(s.moduleId);
        return (
            row &&
            (row.completedVideos !== s.completedVideos ||
                row.totalVideos !== s.totalVideos ||
                row.progress !== s.progress ||
                row.isCompleted !== s.isCompleted)
        );
    });

    const milestonesToCreate = milestoneStates.filter((s) => !existingMilestones.has(s.milestoneId));
    const milestonesToUpdate = milestoneStates.filter((s) => {
        const row = existingMilestones.get(s.milestoneId);
        return (
            row &&
            (row.completedModules !== s.completedModules ||
                row.totalModules !== s.totalModules ||
                row.progress !== s.progress ||
                row.isCompleted !== s.isCompleted)
        );
    });

    await prisma.$transaction(
        async (tx) => {
            // createMany collapses a fresh enrollment's whole curriculum into
            // two statements instead of one per module.
            //
            // `skipDuplicates` is what makes this safe to run concurrently. The
            // rows to create are diffed from a snapshot read *outside* the
            // transaction, so two overlapping recalculations for the same
            // enrolment can both conclude a row is missing and both try to
            // insert it — without this the loser dies on the unique index
            // (P2002) and that student's progress is silently left stale.
            if (modulesToCreate.length > 0) {
                await tx.moduleProgress.createMany({
                    data: modulesToCreate.map((s) => ({
                        enrollmentId,
                        studentId: enrollment.studentId,
                        ...s,
                        completedAt: s.isCompleted ? now : null,
                    })),
                    skipDuplicates: true,
                });
            }

            if (milestonesToCreate.length > 0) {
                await tx.milestoneProgress.createMany({
                    data: milestonesToCreate.map((s) => ({
                        enrollmentId,
                        studentId: enrollment.studentId,
                        ...s,
                        completedAt: s.isCompleted ? now : null,
                    })),
                    skipDuplicates: true,
                });
            }

            for (const state of modulesToUpdate) {
                await tx.moduleProgress.update({
                    where: { enrollmentId_moduleId: { enrollmentId, moduleId: state.moduleId } },
                    data: {
                        ...state,
                        // Stamp on the transition to complete, clear when it
                        // regresses, and otherwise leave the original time.
                        completedAt: state.isCompleted
                            ? existingModules.get(state.moduleId)?.completedAt ?? now
                            : null,
                    },
                });
            }

            for (const state of milestonesToUpdate) {
                await tx.milestoneProgress.update({
                    where: {
                        enrollmentId_milestoneId: { enrollmentId, milestoneId: state.milestoneId },
                    },
                    data: {
                        ...state,
                        completedAt: state.isCompleted
                            ? existingMilestones.get(state.milestoneId)?.completedAt ?? now
                            : null,
                    },
                });
            }

            await tx.enrollment.update({
                where: { id: enrollmentId },
                data: {
                    progress,
                    // When everything is done there is no "next" module, so
                    // leave the pointer where it was rather than nulling it.
                    ...(currentModuleId ? { currentModuleId } : {}),
                    ...(currentMilestoneId ? { currentMilestoneId } : {}),
                    ...(courseJustCompleted
                        ? { status: EnrollmentStatus.COMPLETED, completedAt: now }
                        : {}),
                    // New content published after completion reopens the
                    // enrollment so the student is nudged back in.
                    ...(!isCourseComplete && enrollment.status === EnrollmentStatus.COMPLETED
                        ? { status: EnrollmentStatus.ACTIVE, completedAt: null }
                        : {}),
                },
            });
        },
        // Headroom for the first call on a large course, which creates every
        // progress row at once. Steady-state calls are a few statements.
        { timeout: 20_000, maxWait: 10_000 },
    );

    // Finishing in time may earn the course's completion reward.
    if (courseJustCompleted) await grantCompletionReward(enrollmentId, RewardCondition.COURSE_COMPLETE, now);

    return { progress, newlyCompletedModuleIds, newlyCompletedMilestoneIds, courseJustCompleted };
};

/**
 * Marks a video watched and cascades the result up the progress chain,
 * awarding XP for every threshold crossed.
 */
const markVideoComplete = async (user: IRequestUser, videoId: string) => {
    const video = await prisma.video.findFirst({
        where: { id: videoId, isPublished: true },
        select: { id: true, courseId: true, moduleId: true, duration: true },
    });
    if (!video) throw new AppError(status.NOT_FOUND, "Video not found.");

    const enrollment = await requireEnrollment(user, video.courseId);
    await assertModuleUnlocked(enrollment.id, video.moduleId);
    logger.update("Marking video complete", { videoId, studentId: user.userId });

    // Written first and on its own: `recalculateProgress` reads these rows back
    // to derive every percentage. Should the process die between here and the
    // recalculation, the video stays marked and the percentages self-heal on
    // the next call — the ledger of what was watched is what matters.
    await prisma.videoProgress.upsert({
        where: { enrollmentId_videoId: { enrollmentId: enrollment.id, videoId } },
        create: {
            enrollmentId: enrollment.id,
            studentId: user.userId,
            videoId,
            moduleId: video.moduleId,
            isCompleted: true,
            watchedSeconds: video.duration,
            completedAt: new Date(),
        },
        update: { isCompleted: true, watchedSeconds: video.duration, completedAt: new Date() },
    });

    const result = await recalculateProgress(enrollment.id);

    // Awards are idempotent on (student, source, refId) and are deliberately
    // outside the transaction: a duplicate or failed award must never roll back
    // the progress the student actually earned.
    await awardXp(prisma, {
        studentId: user.userId,
        courseId: video.courseId,
        source: XpSource.VIDEO_COMPLETE,
        refId: videoId,
    });

    for (const moduleId of result.newlyCompletedModuleIds) {
        await awardXp(prisma, {
            studentId: user.userId,
            courseId: video.courseId,
            source: XpSource.MODULE_COMPLETE,
            refId: moduleId,
        });
    }

    for (const milestoneId of result.newlyCompletedMilestoneIds) {
        await awardXp(prisma, {
            studentId: user.userId,
            courseId: video.courseId,
            source: XpSource.MILESTONE_COMPLETE,
            refId: milestoneId,
        });
    }

    if (result.courseJustCompleted) {
        await awardXp(prisma, {
            studentId: user.userId,
            courseId: video.courseId,
            source: XpSource.COURSE_COMPLETE,
            refId: video.courseId,
        });
    }

    return {
        videoId,
        courseProgress: result.progress,
        completedModules: result.newlyCompletedModuleIds,
        completedMilestones: result.newlyCompletedMilestoneIds,
        courseCompleted: result.courseJustCompleted,
        // Finishing a reward course earns no certificate — the player says so instead.
        rewardWith: result.courseJustCompleted ? await rewardMainCourse(user.userId, video.courseId) : null,
    };
};

/**
 * Records playback position without marking the video done — called
 * periodically by the player so "continue watching" resumes where the student
 * left off.
 */
const updateWatchPosition = async (user: IRequestUser, videoId: string, watchedSeconds: number) => {
    const video = await prisma.video.findFirst({
        where: { id: videoId, isPublished: true },
        select: { id: true, courseId: true, moduleId: true, duration: true },
    });
    if (!video) throw new AppError(status.NOT_FOUND, "Video not found.");

    const enrollment = await requireEnrollment(user, video.courseId);

    // Clamp: a client reporting a position past the end (or negative) would
    // make the resume point nonsensical.
    const clamped = Math.max(
        0,
        video.duration > 0 ? Math.min(watchedSeconds, video.duration) : watchedSeconds,
    );

    const existing = await prisma.videoProgress.findUnique({
        where: { enrollmentId_videoId: { enrollmentId: enrollment.id, videoId } },
        select: { watchedSeconds: true },
    });

    return prisma.videoProgress.upsert({
        where: { enrollmentId_videoId: { enrollmentId: enrollment.id, videoId } },
        create: {
            enrollmentId: enrollment.id,
            studentId: user.userId,
            videoId,
            moduleId: video.moduleId,
            watchedSeconds: clamped,
        },
        // Never move the marker backwards — re-watching from the start
        // shouldn't lose the furthest position reached.
        update: { watchedSeconds: Math.max(clamped, existing?.watchedSeconds ?? 0) },
    });
};

/** Undo, for a student who wants to redo a module. */
const markVideoIncomplete = async (user: IRequestUser, videoId: string) => {
    const video = await prisma.video.findFirst({
        where: { id: videoId },
        select: { id: true, courseId: true },
    });
    if (!video) throw new AppError(status.NOT_FOUND, "Video not found.");

    const enrollment = await requireEnrollment(user, video.courseId);

    await prisma.videoProgress.updateMany({
        where: { enrollmentId: enrollment.id, videoId },
        data: { isCompleted: false, completedAt: null },
    });

    // XP already earned is deliberately not clawed back — the ledger records
    // what happened, it isn't a mirror of current state.
    return recalculateProgress(enrollment.id);
};

/**
 * Recalculates every active enrolment on a course.
 *
 * Progress is derived from the *published* curriculum, so publishing or
 * unpublishing content silently invalidates every student's percentage. Without
 * this, a student who finished a course before a new module landed would keep
 * showing 100% and stay eligible for a certificate covering material they have
 * never seen.
 *
 * Runs in small batches with a delay between them: the recalculation is not
 * urgent, and a popular course could hold thousands of enrolments that must not
 * monopolise the connection pool the request path shares.
 */
const recalculateCourseEnrollments = async (courseId: string) => {
    const enrollments = await prisma.enrollment.findMany({
        where: { courseId, status: { not: EnrollmentStatus.CANCELLED } },
        select: { id: true },
    });

    const BATCH_SIZE = 20;
    let recalculated = 0;

    for (let i = 0; i < enrollments.length; i += BATCH_SIZE) {
        const batch = enrollments.slice(i, i + BATCH_SIZE);

        await Promise.all(
            batch.map((enrollment) =>
                recalculateProgress(enrollment.id).catch((error) => {
                    // One bad enrolment must not abandon the rest of the cohort.
                    logger.error(`Progress recalculation failed for enrolment ${enrollment.id}`, error);
                }),
            ),
        );

        recalculated += batch.length;

        if (i + BATCH_SIZE < enrollments.length) {
            await new Promise((resolve) => setTimeout(resolve, 100));
        }
    }

    logger.info("Recalculated course enrolments after a curriculum change", {
        courseId,
        recalculated,
    });

    return { recalculated };
};

/**
 * Courses with a recalculation in flight, and whether more work arrived while
 * it was running.
 */
const inFlight = new Map<string, { rerun: boolean }>();

/**
 * Fire-and-forget wrapper for the write paths that change publish state. The
 * mentor's request returns immediately; the cohort catches up in the
 * background.
 *
 * Publishing a milestone, then its module, then its lessons is three writes in
 * a few seconds, and each one schedules a pass. Running them concurrently over
 * the same rows is wasted work at best. Instead one pass runs at a time per
 * course and anything that arrives mid-flight sets a flag, so exactly one more
 * pass runs afterwards — the last state always wins without a pile-up.
 */
export const scheduleCourseRecalculation = (courseId: string) => {
    const existing = inFlight.get(courseId);
    if (existing) {
        existing.rerun = true;
        return;
    }

    const entry = { rerun: false };
    inFlight.set(courseId, entry);

    void (async () => {
        try {
            do {
                entry.rerun = false;
                await recalculateCourseEnrollments(courseId);
            } while (entry.rerun);
        } catch (error) {
            logger.error(`Course-wide progress recalculation failed for ${courseId}`, error);
        } finally {
            inFlight.delete(courseId);
        }
    })();
};

export const ProgressService = {
    markVideoComplete,
    markVideoIncomplete,
    updateWatchPosition,
    recalculateProgress,
    recalculateCourseEnrollments,
    scheduleCourseRecalculation,
};
