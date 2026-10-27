import status from "http-status";
import { CourseType, SubmissionStatus } from "../../../generated/prisma/enums";
import AppError from "../../errorHelpers/AppError";
import { IRequestUser } from "../../interfaces/requestUser.interface";
import { prisma } from "../../lib/prisma";
import { assertModuleUnlocked, requireCourseAccess } from "../../utils/courseAccess";
import { isSequentialLearningEnabled } from "../../utils/platformSettings";
import { PRACTICE_COURSE_FILTER } from "../../utils/weekItems";
import { formatDuration } from "../../utils/youtube";
import { outlineWeekSelect } from "../outline/outline.service";

/**
 * The full learning interface for one enrolled course (plan §15): the whole
 * published curriculum, annotated with what this student has completed and
 * what is still locked.
 *
 * Video URLs are included here — this endpoint is only reachable after
 * `requireCourseAccess` confirms an enrolment (or staff membership), which is
 * exactly the paywall the plan calls for in §33.
 */
const getCourseLearning = async (user: IRequestUser, slug: string) => {
    const course = await prisma.course.findFirst({
        where: { slug, isDeleted: false },
        select: {
            id: true, title: true, slug: true, thumbnail: true, duration: true, courseType: true, phase: true,
            milestoneLabel: true, moduleLabel: true,
        },
    });
    if (!course) throw new AppError(status.NOT_FOUND, "Course not found.");

    const enrollment = await requireCourseAccess(user, course.id);

    const [milestones, sequential] = await Promise.all([
        prisma.milestone.findMany({
            where: { courseId: course.id, isPublished: true },
            orderBy: { order: "asc" },
            include: {
                modules: {
                    where: { isPublished: true },
                    orderBy: { order: "asc" },
                    include: {
                        videos: {
                            where: { isPublished: true },
                            orderBy: { order: "asc" },
                        },
                        quizzes: {
                            where: { isPublished: true },
                            select: { id: true, title: true },
                        },
                    },
                },
                assignments: { where: { isPublished: true }, orderBy: { order: "asc" } },
                practiceDays: { where: { isPublished: true, ...PRACTICE_COURSE_FILTER }, orderBy: { order: "asc" } },
            },
        }),
        isSequentialLearningEnabled(),
    ]);

    // Staff previewing the course have no enrollment, so there is no progress
    // to overlay and nothing is locked.
    const [videoProgress, moduleProgress, milestoneProgress, submissions, practiceDone, quizAttempts] =
        enrollment
            ? await Promise.all([
                prisma.videoProgress.findMany({ where: { enrollmentId: enrollment.id } }),
                prisma.moduleProgress.findMany({ where: { enrollmentId: enrollment.id } }),
                prisma.milestoneProgress.findMany({ where: { enrollmentId: enrollment.id } }),
                prisma.assignmentSubmission.findMany({
                    where: { enrollmentId: enrollment.id },
                    select: { assignmentId: true, status: true, score: true, submittedAt: true },
                }),
                prisma.practiceCompletion.findMany({
                    where: { enrollmentId: enrollment.id },
                    select: { practiceDayId: true, completedAt: true },
                }),
                prisma.quizAttempt.findMany({
                    where: { enrollmentId: enrollment.id, status: "COMPLETED" },
                    select: { quizId: true, percentage: true },
                }),
            ])
            : [[], [], [], [], [], []];

    const videoProgressById = new Map(videoProgress.map((p) => [p.videoId, p]));
    const moduleProgressById = new Map(moduleProgress.map((p) => [p.moduleId, p]));
    const milestoneProgressById = new Map(milestoneProgress.map((p) => [p.milestoneId, p]));
    const submissionByAssignment = new Map(submissions.map((s) => [s.assignmentId, s]));
    const practiceById = new Map(practiceDone.map((p) => [p.practiceDayId, p]));

    // Best score per quiz — a student may have several completed attempts.
    const bestScoreByQuiz = new Map<string, number>();
    for (const attempt of quizAttempts) {
        const current = bestScoreByQuiz.get(attempt.quizId);
        if (current === undefined || attempt.percentage > current) {
            bestScoreByQuiz.set(attempt.quizId, attempt.percentage);
        }
    }

    // Under sequential learning a module unlocks only once every earlier
    // module in the course is finished (plan §15). Tracked as a single running
    // flag because the curriculum is walked in order.
    let previousModulesComplete = true;

    const curriculum = milestones.map((milestone) => {
        const mProgress = milestoneProgressById.get(milestone.id);

        const modules = milestone.modules.map((courseModule) => {
            const progress = moduleProgressById.get(courseModule.id);
            const isCompleted = progress?.isCompleted ?? false;
            const isLocked = Boolean(enrollment) && sequential && !previousModulesComplete;

            if (!isCompleted) previousModulesComplete = false;

            // At most one quiz per module (see the `Quiz` model) — withheld
            // while the module is locked, same as its videos.
            const quiz = courseModule.quizzes[0];

            return {
                id: courseModule.id,
                title: courseModule.title,
                description: courseModule.description,
                order: courseModule.order,
                // Place in the week's mixed list with its assignments and practice days.
                position: courseModule.position,
                // Online or offline, on a course that runs both — null anywhere else.
                mode: courseModule.mode,
                isLocked,
                isCompleted,
                progress: progress?.progress ?? 0,
                completedVideos: progress?.completedVideos ?? 0,
                totalVideos: courseModule.videos.length,
                quiz:
                    quiz && !isLocked
                        ? {
                            id: quiz.id,
                            title: quiz.title,
                            isCompleted: bestScoreByQuiz.has(quiz.id),
                            bestScore: bestScoreByQuiz.get(quiz.id) ?? null,
                        }
                        : null,
                videos: courseModule.videos.map((video) => {
                    const vp = videoProgressById.get(video.id);
                    return {
                        id: video.id,
                        type: video.type,
                        title: video.title,
                        description: video.description,
                        order: video.order,
                        thumbnail: video.thumbnail,
                        duration: video.duration,
                        durationLabel: formatDuration(video.duration),
                        // Withheld while the module is locked so a locked
                        // module's content genuinely isn't reachable —
                        // whichever of the three the lesson carries.
                        youtubeUrl: isLocked ? null : video.youtubeUrl,
                        youtubeVideoId: isLocked ? null : video.youtubeVideoId,
                        content: isLocked ? null : video.content,
                        resourceUrl: isLocked ? null : video.resourceUrl,
                        isCompleted: vp?.isCompleted ?? false,
                        watchedSeconds: vp?.watchedSeconds ?? 0,
                    };
                }),
            };
        });

        return {
            id: milestone.id,
            title: milestone.title,
            description: milestone.description,
            order: milestone.order,
            isCompleted: mProgress?.isCompleted ?? false,
            progress: mProgress?.progress ?? 0,
            modules,
            assignments: milestone.assignments.map((assignment) => {
                const submission = submissionByAssignment.get(assignment.id);
                return {
                    id: assignment.id,
                    title: assignment.title,
                    description: assignment.description,
                    totalMarks: assignment.totalMarks,
                    deadline: assignment.deadline,
                    order: assignment.order,
                    position: assignment.position,
                    submissionStatus: submission?.status ?? null,
                    score: submission?.score ?? null,
                    isSubmitted: Boolean(submission),
                    isAccepted: submission?.status === SubmissionStatus.ACCEPTED,
                };
            }),
            practiceDays: milestone.practiceDays.map((practice) => ({
                id: practice.id,
                title: practice.title,
                description: practice.description,
                order: practice.order,
                position: practice.position,
                isCompleted: practiceById.has(practice.id),
                completedAt: practiceById.get(practice.id)?.completedAt ?? null,
            })),
        };
    });

    const enrollmentDetail = enrollment
        ? await prisma.enrollment.findUnique({
            where: { id: enrollment.id },
            select: {
                id: true, progress: true, status: true, startedAt: true, completedAt: true,
                currentModuleId: true, currentMilestoneId: true,
            },
        })
        : null;

    return {
        course,
        enrollment: enrollmentDetail,
        // Staff preview mode — the client uses this to hide progress controls.
        isPreview: enrollment === null,
        sequentialLearning: sequential,
        curriculum,
    };
};

/**
 * Single video, for the player. Kept separate from the curriculum payload so
 * navigating between lessons doesn't re-fetch the whole course.
 */
const getVideo = async (user: IRequestUser, videoId: string) => {
    const video = await prisma.video.findFirst({
        where: { id: videoId, isPublished: true },
        include: {
            module: { select: { id: true, title: true, order: true, milestoneId: true } },
            course: { select: { id: true, title: true, slug: true } },
        },
    });
    if (!video) throw new AppError(status.NOT_FOUND, "Video not found.");

    const enrollment = await requireCourseAccess(user, video.courseId);
    await assertModuleUnlocked(enrollment?.id ?? null, video.moduleId);

    const progress = enrollment
        ? await prisma.videoProgress.findUnique({
            where: { enrollmentId_videoId: { enrollmentId: enrollment.id, videoId } },
            select: { isCompleted: true, watchedSeconds: true },
        })
        : null;

    // Adjacent lessons inside the same module, for prev/next controls.
    const [previous, next] = await Promise.all([
        prisma.video.findFirst({
            where: { moduleId: video.moduleId, isPublished: true, order: { lt: video.order } },
            orderBy: { order: "desc" },
            select: { id: true, title: true, order: true },
        }),
        prisma.video.findFirst({
            where: { moduleId: video.moduleId, isPublished: true, order: { gt: video.order } },
            orderBy: { order: "asc" },
            select: { id: true, title: true, order: true },
        }),
    ]);

    return {
        ...video,
        durationLabel: formatDuration(video.duration),
        isCompleted: progress?.isCompleted ?? false,
        watchedSeconds: progress?.watchedSeconds ?? 0,
        previousVideo: previous,
        nextVideo: next,
    };
};

/**
 * The planned course outline (`/learn/[slug]/outline`) — the plan the
 * Outline Maker writes, not the real modules. The two never sync. On a
 * bootcamp course an item reads as published once its planned time passes
 * (the client compares it with the clock, so it flips on the minute without a
 * refetch); on a traditional course only items published by hand come back.
 * Either way the module it names — if one even exists — keeps its own state
 * in the Module Manager. Only titles and dates leave here, never lesson
 * content, so nothing else needs withholding.
 */
const getCourseOutline = async (user: IRequestUser, slug: string) => {
    const course = await prisma.course.findFirst({
        where: { slug, isDeleted: false },
        select: { id: true, title: true, slug: true, courseType: true, milestoneLabel: true, moduleLabel: true },
    });
    if (!course) throw new AppError(status.NOT_FOUND, "Course not found.");

    const enrollment = await requireCourseAccess(user, course.id);

    // A traditional outline has no dates: students see only what staff
    // published, in the order they arranged it.
    const isTraditional = course.courseType === CourseType.TRADITIONAL;

    const [enrollmentSummary, weeks] = await Promise.all([
        enrollment
            ? prisma.enrollment.findUnique({ where: { id: enrollment.id }, select: { status: true } })
            : null,
        prisma.outlineWeek.findMany({
            where: { courseId: course.id },
            orderBy: { order: "asc" },
            select: outlineWeekSelect(course.courseType, isTraditional),
        }),
    ]);

    return {
        course,
        enrollment: enrollmentSummary,
        isPreview: enrollment === null,
        weeks: isTraditional
            ? weeks.map((week) => ({
                ...week,
                // Dates left from when it was a bootcamp course mean nothing now.
                items: week.items.map((item) => ({ ...item, scheduledAt: null })),
            }))
            : weeks,
    };
};

export const LearningService = { getCourseLearning, getVideo, getCourseOutline };
