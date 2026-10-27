import status from "http-status";
import { ReactionType } from "../../../generated/prisma/enums";
import AppError from "../../errorHelpers/AppError";
import { IRequestUser } from "../../interfaces/requestUser.interface";
import { prisma } from "../../lib/prisma";
import { requireEnrollment } from "../../utils/courseAccess";
import { formatDuration } from "../../utils/youtube";

/**
 * A student's own layer on top of a video — note, bookmark, reaction — kept
 * off `VideoProgress` on purpose (see `lesson.prisma`): none of these count
 * as watch activity for the dashboard's learning streak.
 */

const findVideoOrThrow = async (videoId: string) => {
    const video = await prisma.video.findFirst({
        where: { id: videoId, isPublished: true },
        select: { id: true, courseId: true },
    });
    if (!video) throw new AppError(status.NOT_FOUND, "Video not found.");
    return video;
};

/** Combined note + bookmark + reaction for one lesson, one round trip. */
const getLessonState = async (user: IRequestUser, videoId: string) => {
    const video = await findVideoOrThrow(videoId);
    await requireEnrollment(user, video.courseId);

    const [note, interaction] = await Promise.all([
        prisma.lessonNote.findUnique({
            where: { studentId_videoId: { studentId: user.userId, videoId } },
            select: { content: true, updatedAt: true },
        }),
        prisma.lessonInteraction.findUnique({
            where: { studentId_videoId: { studentId: user.userId, videoId } },
            select: { isBookmarked: true, reaction: true },
        }),
    ]);

    return {
        note: note?.content ?? null,
        noteUpdatedAt: note?.updatedAt ?? null,
        isBookmarked: interaction?.isBookmarked ?? false,
        reaction: interaction?.reaction ?? null,
    };
};

/** Empty content deletes the note rather than storing a blank row. */
const saveNote = async (user: IRequestUser, videoId: string, content: string) => {
    const video = await findVideoOrThrow(videoId);
    await requireEnrollment(user, video.courseId);

    const trimmed = content.trim();

    if (!trimmed) {
        await prisma.lessonNote.deleteMany({ where: { studentId: user.userId, videoId } });
        return { note: null };
    }

    const note = await prisma.lessonNote.upsert({
        where: { studentId_videoId: { studentId: user.userId, videoId } },
        create: { studentId: user.userId, videoId, content: trimmed },
        update: { content: trimmed },
        select: { content: true, updatedAt: true },
    });

    return { note: note.content, noteUpdatedAt: note.updatedAt };
};

const setBookmark = async (user: IRequestUser, videoId: string, bookmarked: boolean) => {
    const video = await findVideoOrThrow(videoId);
    await requireEnrollment(user, video.courseId);

    const interaction = await prisma.lessonInteraction.upsert({
        where: { studentId_videoId: { studentId: user.userId, videoId } },
        create: { studentId: user.userId, videoId, isBookmarked: bookmarked },
        update: { isBookmarked: bookmarked },
        select: { isBookmarked: true, reaction: true },
    });

    return interaction;
};

const setReaction = async (user: IRequestUser, videoId: string, reaction: ReactionType | null) => {
    const video = await findVideoOrThrow(videoId);
    await requireEnrollment(user, video.courseId);

    const interaction = await prisma.lessonInteraction.upsert({
        where: { studentId_videoId: { studentId: user.userId, videoId } },
        create: { studentId: user.userId, videoId, reaction },
        update: { reaction },
        select: { isBookmarked: true, reaction: true },
    });

    return interaction;
};

/** Every lesson this student has bookmarked in one course, in curriculum order. */
const getCourseBookmarks = async (user: IRequestUser, courseId: string) => {
    await requireEnrollment(user, courseId);

    const bookmarks = await prisma.lessonInteraction.findMany({
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
    });

    // Only a video has a running time; the others get the same short label
    // the curriculum sidebar shows.
    const labelFor = (video: { type: string; duration: number }) =>
        video.type === "TEXT" ? "Read" : video.type === "RESOURCE" ? "Link" : formatDuration(video.duration);

    return bookmarks
        .filter((b) => b.video)
        .map((b) => ({
            videoId: b.videoId,
            title: b.video!.title,
            durationLabel: labelFor(b.video!),
            moduleId: b.video!.module.id,
            moduleTitle: b.video!.module.title,
        }))
        .sort((a, b) => a.moduleTitle.localeCompare(b.moduleTitle));
};

export const LessonService = {
    getLessonState,
    saveNote,
    setBookmark,
    setReaction,
    getCourseBookmarks,
};
