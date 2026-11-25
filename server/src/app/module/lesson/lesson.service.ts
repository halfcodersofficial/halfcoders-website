import status from "http-status";
import { ReactionType } from "../../../generated/prisma/enums";
import AppError from "../../errorHelpers/AppError";
import { IRequestUser } from "../../interfaces/requestUser.interface";
import { prisma } from "../../lib/prisma";
import { requireEnrollment } from "../../utils/courseAccess";
import { formatDuration } from "../../utils/youtube";

/**
 * A student's own layer on top of a lesson — note, bookmark, reaction — kept
 * off `VideoProgress` on purpose (see `lesson.prisma`): none of these count
 * as watch activity for the dashboard's learning streak. A lesson is a
 * module's (a `Video`) or a practice day's (a `PracticeMaterial`); the same
 * rows carry both, keyed on whichever it is.
 */

export type LessonRef = { kind: "video"; id: string } | { kind: "practice"; id: string };

/** The lesson's course, if it's one students can see — or a 404. */
const courseOfLesson = async (ref: LessonRef) => {
    const lesson =
        ref.kind === "video"
            ? await prisma.video.findFirst({ where: { id: ref.id, isPublished: true }, select: { courseId: true } })
            : await prisma.practiceMaterial.findFirst({ where: { id: ref.id, practiceDay: { isPublished: true } }, select: { courseId: true } });
    if (!lesson) throw new AppError(status.NOT_FOUND, "Lesson not found.");
    return lesson.courseId;
};

/** The row's own key for this student on this lesson. */
const uniqueKey = (studentId: string, ref: LessonRef) =>
    ref.kind === "video"
        ? { studentId_videoId: { studentId, videoId: ref.id } }
        : { studentId_practiceMaterialId: { studentId, practiceMaterialId: ref.id } };

const lessonField = (ref: LessonRef) => (ref.kind === "video" ? { videoId: ref.id } : { practiceMaterialId: ref.id });

/** Combined note + bookmark + reaction for one lesson, one round trip. */
const getLessonState = async (user: IRequestUser, ref: LessonRef) => {
    await requireEnrollment(user, await courseOfLesson(ref));

    const [note, interaction] = await Promise.all([
        prisma.lessonNote.findUnique({ where: uniqueKey(user.userId, ref), select: { content: true, updatedAt: true } }),
        prisma.lessonInteraction.findUnique({ where: uniqueKey(user.userId, ref), select: { isBookmarked: true, reaction: true } }),
    ]);

    return {
        note: note?.content ?? null,
        noteUpdatedAt: note?.updatedAt ?? null,
        isBookmarked: interaction?.isBookmarked ?? false,
        reaction: interaction?.reaction ?? null,
    };
};

/** Empty content deletes the note rather than storing a blank row. */
const saveNote = async (user: IRequestUser, ref: LessonRef, content: string) => {
    await requireEnrollment(user, await courseOfLesson(ref));

    const trimmed = content.trim();

    if (!trimmed) {
        await prisma.lessonNote.deleteMany({ where: { studentId: user.userId, ...lessonField(ref) } });
        return { note: null };
    }

    const note = await prisma.lessonNote.upsert({
        where: uniqueKey(user.userId, ref),
        create: { studentId: user.userId, ...lessonField(ref), content: trimmed },
        update: { content: trimmed },
        select: { content: true, updatedAt: true },
    });

    return { note: note.content, noteUpdatedAt: note.updatedAt };
};

const setBookmark = async (user: IRequestUser, ref: LessonRef, bookmarked: boolean) => {
    await requireEnrollment(user, await courseOfLesson(ref));

    return prisma.lessonInteraction.upsert({
        where: uniqueKey(user.userId, ref),
        create: { studentId: user.userId, ...lessonField(ref), isBookmarked: bookmarked },
        update: { isBookmarked: bookmarked },
        select: { isBookmarked: true, reaction: true },
    });
};

const setReaction = async (user: IRequestUser, ref: LessonRef, reaction: ReactionType | null) => {
    await requireEnrollment(user, await courseOfLesson(ref));

    return prisma.lessonInteraction.upsert({
        where: uniqueKey(user.userId, ref),
        create: { studentId: user.userId, ...lessonField(ref), reaction },
        update: { reaction },
        select: { isBookmarked: true, reaction: true },
    });
};

// Only a video has a running time; the others get the same short label the
// curriculum sidebar shows.
const labelFor = (lesson: { type: string; duration?: number }) =>
    lesson.type === "TEXT" ? "Read" : lesson.type === "RESOURCE" ? "Link" : lesson.duration ? formatDuration(lesson.duration) : "Video";

/**
 * Every lesson this student has bookmarked in one course — a module's, or a
 * practice day's that students can still see — each with where it sits.
 */
const getCourseBookmarks = async (user: IRequestUser, courseId: string) => {
    await requireEnrollment(user, courseId);

    const [videos, practice] = await Promise.all([
        prisma.lessonInteraction.findMany({
            where: { studentId: user.userId, isBookmarked: true, video: { courseId } },
            select: {
                videoId: true,
                video: {
                    select: {
                        id: true, type: true, title: true, duration: true, order: true,
                        module: { select: { id: true, title: true, milestoneId: true } },
                    },
                },
            },
        }),
        prisma.lessonInteraction.findMany({
            where: { studentId: user.userId, isBookmarked: true, practiceMaterial: { courseId, practiceDay: { isPublished: true } } },
            select: {
                practiceMaterial: { select: { id: true, type: true, title: true, practiceDay: { select: { id: true, title: true } } } },
            },
        }),
    ]);

    return [
        ...videos
            .filter((b) => b.video && b.videoId)
            .map((b) => ({
                videoId: b.videoId,
                practiceMaterialId: null,
                practiceDayId: null,
                title: b.video!.title,
                durationLabel: labelFor(b.video!),
                moduleId: b.video!.module.id,
                moduleTitle: b.video!.module.title,
            })),
        ...practice
            .filter((b) => b.practiceMaterial)
            .map(({ practiceMaterial: material }) => ({
                videoId: null,
                practiceMaterialId: material!.id,
                practiceDayId: material!.practiceDay.id,
                title: material!.title,
                durationLabel: labelFor(material!),
                moduleId: null,
                moduleTitle: material!.practiceDay.title,
            })),
    ].sort((a, b) => a.moduleTitle.localeCompare(b.moduleTitle));
};

export const LessonService = {
    getLessonState,
    saveNote,
    setBookmark,
    setReaction,
    getCourseBookmarks,
};
