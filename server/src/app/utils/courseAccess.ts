import status from "http-status";
import { Prisma } from "../../generated/prisma/client";
import { EnrollmentStatus, QuizAttemptStatus } from "../../generated/prisma/enums";
import { Role } from "../lib/roles";
import AppError from "../errorHelpers/AppError";
import { IRequestUser } from "../interfaces/requestUser.interface";
import { prisma } from "../lib/prisma";
import { isSequentialLearningEnabled } from "./platformSettings";

const isAdmin = (user: IRequestUser) => user.role === Role.ADMIN || user.role === Role.SUPER_ADMIN;

/**
 * Gate for every curriculum write (milestones, modules, videos, assignments).
 *
 * Admins manage any course; a mentor may only touch courses they are actually
 * assigned to (plan §19, §21). Without this check any authenticated mentor
 * could edit a colleague's course by guessing its id.
 */
export const assertCanManageCourse = async (user: IRequestUser, courseId: string) => {
    const course = await prisma.course.findFirst({
        where: { id: courseId, isDeleted: false },
        select: { id: true },
    });
    if (!course) throw new AppError(status.NOT_FOUND, "Course not found.");

    if (isAdmin(user)) return;

    if (user.role === Role.MENTOR) {
        const assigned = await prisma.courseMentor.findUnique({
            where: { courseId_mentorId: { courseId, mentorId: user.userId } },
            select: { id: true },
        });
        if (assigned) return;
    }

    throw new AppError(status.FORBIDDEN, "You are not assigned to this course.");
};

/**
 * Gate for learning content (video URLs, assignment briefs). Returns the
 * enrollment so callers can record progress against it.
 *
 * Admins and assigned mentors are allowed through without an enrollment so
 * they can preview exactly what students see.
 */
export const requireCourseAccess = async (user: IRequestUser, courseId: string) => {
    const enrollment = await prisma.enrollment.findUnique({
        where: { studentId_courseId: { studentId: user.userId, courseId } },
        select: { id: true, status: true, expiresAt: true },
    });

    if (enrollment) {
        if (enrollment.status === EnrollmentStatus.CANCELLED) {
            throw new AppError(status.FORBIDDEN, "Your enrolment in this course was cancelled.");
        }
        if (enrollment.expiresAt && enrollment.expiresAt < new Date()) {
            throw new AppError(status.FORBIDDEN, "Your access to this course has expired.");
        }
        return enrollment;
    }

    if (isAdmin(user)) return null;

    if (user.role === Role.MENTOR) {
        const assigned = await prisma.courseMentor.findUnique({
            where: { courseId_mentorId: { courseId, mentorId: user.userId } },
            select: { id: true },
        });
        if (assigned) return null;
    }

    throw new AppError(status.FORBIDDEN, "Enrol in this course to access its content.");
};

/** Same as above but insists on a real student enrollment (progress writes). */
export const requireEnrollment = async (user: IRequestUser, courseId: string) => {
    const enrollment = await requireCourseAccess(user, courseId);
    if (!enrollment) {
        throw new AppError(
            status.FORBIDDEN,
            "Only enrolled students can record progress for this course.",
        );
    }
    return enrollment;
};

export const isCourseAdmin = isAdmin;

/**
 * Under sequential learning (plan §15) a module opens only once every earlier
 * published module of its course — in an earlier milestone, or earlier in the
 * same one — is complete. The same walk the curriculum draws its locks from
 * (learning.service), checked again wherever a module's content is served or
 * recorded, so a lesson link or a direct API call can't skip ahead. Staff
 * previewing a course have no enrolment and are never locked out.
 */
export const isModuleLocked = async (enrollmentId: string | null, moduleId: string): Promise<boolean> => {
    if (!enrollmentId || !(await isSequentialLearningEnabled())) return false;

    const target = await prisma.courseModule.findUnique({
        where: { id: moduleId },
        select: { courseId: true, milestoneId: true, order: true, milestone: { select: { order: true } } },
    });
    if (!target) return false;

    const earlier = await prisma.courseModule.findMany({
        where: {
            courseId: target.courseId,
            isPublished: true,
            milestone: { isPublished: true },
            OR: [
                { milestone: { order: { lt: target.milestone.order } } },
                { milestoneId: target.milestoneId, order: { lt: target.order } },
            ],
        },
        select: { id: true },
    });
    if (earlier.length === 0) return false;

    const completed = await prisma.moduleProgress.count({
        where: { enrollmentId, moduleId: { in: earlier.map((module) => module.id) }, isCompleted: true },
    });
    return completed < earlier.length;
};

export const assertModuleUnlocked = async (enrollmentId: string | null, moduleId: string) => {
    if (await isModuleLocked(enrollmentId, moduleId)) {
        throw new AppError(status.FORBIDDEN, "This module is still locked — finish the ones before it first.");
    }
};

/**
 * Lessons are marked complete in course order: milestone, then module, then
 * lesson — the same order the learning page numbers them in. Every earlier
 * published lesson has to be complete first, not just the one right before,
 * so un-marking an early lesson (or progress recorded before this rule)
 * can't leave a gap the student skips over. Every quiz before the lesson
 * has to be taken too — a module's quiz is a step of the course, not an
 * extra, so nothing after it can be finished without it. Applies whether or
 * not sequential learning is on: that setting decides what can be *opened*,
 * this decides what can be *finished*.
 */
export const assertEarlierLessonsComplete = async (enrollmentId: string, videoId: string) => {
    const target = await prisma.video.findUnique({
        where: { id: videoId },
        select: { moduleId: true, order: true },
    });
    if (!target) return;

    const firstUnfinished = await firstUnfinishedLessonBefore(enrollmentId, target.moduleId, { lt: target.order });
    if (firstUnfinished) {
        throw new AppError(
            status.FORBIDDEN,
            `Complete the lessons before this one first — start with "${firstUnfinished.title}".`,
        );
    }

    const untakenQuiz = await firstUntakenQuizBefore(enrollmentId, target.moduleId, target.order);
    if (untakenQuiz) {
        throw new AppError(status.FORBIDDEN, `Take the quiz "${untakenQuiz.title}" first — the lessons after it open once it's done.`);
    }
};

/**
 * The earliest published quiz before a lesson that the student hasn't
 * finished an attempt at: every quiz of earlier milestones and earlier
 * modules, plus the lesson's own module's quiz when staff placed it above
 * the lesson (one at the end of the module, `position` null, isn't).
 */
const firstUntakenQuizBefore = async (enrollmentId: string, moduleId: string, lessonOrder: number) => {
    const target = await prisma.courseModule.findUnique({
        where: { id: moduleId },
        select: { courseId: true, milestoneId: true, order: true, milestone: { select: { order: true } } },
    });
    if (!target) return null;

    const untaken = await prisma.quiz.findMany({
        where: {
            courseId: target.courseId,
            isPublished: true,
            module: { isPublished: true, milestone: { isPublished: true } },
            OR: [
                { module: { milestone: { order: { lt: target.milestone.order } } } },
                { module: { milestoneId: target.milestoneId, order: { lt: target.order } } },
                { moduleId, position: { lt: lessonOrder } },
            ],
            attempts: { none: { enrollmentId, status: QuizAttemptStatus.COMPLETED } },
        },
        select: { title: true, module: { select: { order: true, milestone: { select: { order: true } } } } },
    });

    // The earliest one, so the student is told where to go.
    return (
        untaken.sort(
            (a, b) => a.module.milestone.order - b.module.milestone.order || a.module.order - b.module.order,
        )[0] ?? null
    );
};

/**
 * A module's quiz opens once every lesson before it is complete: the lessons
 * of its module up to where staff placed it (all of them when it sits at the
 * end) and every lesson of the course before that module — the order the
 * learning page walks. A notification link or a direct API call can't open
 * it early. Like `assertEarlierLessonsComplete`, this holds whether or not
 * sequential learning is on.
 */
export const assertLessonsBeforeQuizComplete = async (
    enrollmentId: string,
    quiz: { moduleId: string; position: number | null },
) => {
    const firstUnfinished = await firstUnfinishedLessonBefore(
        enrollmentId,
        quiz.moduleId,
        quiz.position === null ? undefined : { lte: quiz.position },
    );
    if (firstUnfinished) {
        throw new AppError(
            status.FORBIDDEN,
            `Finish the lessons before this quiz first — start with "${firstUnfinished.title}".`,
        );
    }
};

/**
 * The earliest published lesson the student hasn't completed among those
 * before a point in the course: every lesson of earlier milestones and
 * earlier modules, plus the lessons of `moduleId` whose order matches
 * `withinModule` (every one of them when it's left out).
 */
const firstUnfinishedLessonBefore = async (
    enrollmentId: string,
    moduleId: string,
    withinModule?: Prisma.IntFilter,
) => {
    const target = await prisma.courseModule.findUnique({
        where: { id: moduleId },
        select: { courseId: true, milestoneId: true, order: true, milestone: { select: { order: true } } },
    });
    if (!target) return null;

    const earlier = await prisma.video.findMany({
        where: {
            courseId: target.courseId,
            isPublished: true,
            module: { isPublished: true, milestone: { isPublished: true } },
            OR: [
                { module: { milestone: { order: { lt: target.milestone.order } } } },
                { module: { milestoneId: target.milestoneId, order: { lt: target.order } } },
                { moduleId, ...(withinModule && { order: withinModule }) },
            ],
        },
        select: {
            id: true,
            title: true,
            order: true,
            module: { select: { order: true, milestone: { select: { order: true } } } },
        },
    });
    if (earlier.length === 0) return null;

    const completed = await prisma.videoProgress.findMany({
        where: { enrollmentId, videoId: { in: earlier.map((video) => video.id) }, isCompleted: true },
        select: { videoId: true },
    });
    const completedIds = new Set(completed.map((row) => row.videoId));

    // The earliest one, so the student is told where to go.
    return (
        earlier
            .filter((video) => !completedIds.has(video.id))
            .sort(
                (a, b) =>
                    a.module.milestone.order - b.module.milestone.order ||
                    a.module.order - b.module.order ||
                    a.order - b.order,
            )[0] ?? null
    );
};
