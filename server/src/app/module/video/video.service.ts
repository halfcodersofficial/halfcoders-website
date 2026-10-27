import status from "http-status";
import { LessonType } from "../../../generated/prisma/enums";
import AppError from "../../errorHelpers/AppError";
import { IRequestUser } from "../../interfaces/requestUser.interface";
import { prisma } from "../../lib/prisma";
import { assertCanManageCourse } from "../../utils/courseAccess";
import { logger } from "../../utils/logger";
import { applyOrdering, assertCompleteOrdering } from "../../utils/ordering";
import { requireYoutubeVideoId, toSeconds, youtubeThumbnailUrl } from "../../utils/youtube";
import { scheduleCourseRecalculation } from "../progress/progress.service";

const loadModuleForWrite = async (user: IRequestUser, moduleId: string) => {
    const courseModule = await prisma.courseModule.findUnique({
        where: { id: moduleId },
        select: { id: true, courseId: true },
    });
    if (!courseModule) throw new AppError(status.NOT_FOUND, "Module not found.");

    await assertCanManageCourse(user, courseModule.courseId);
    return courseModule;
};

type CreatePayload = {
    moduleId: string;
    type?: LessonType;
    title: string;
    youtubeUrl?: string;
    content?: string;
    resourceUrl?: string;
    description?: string;
    duration?: string | number;
    thumbnail?: string;
    order?: number;
    isPublished?: boolean;
    isFreePreview?: boolean;
};

/**
 * The columns a lesson of each type stores — and only those, so a text lesson
 * never carries a stray YouTube link. Validation has already required the
 * field the type needs.
 */
const typeFields = (payload: CreatePayload) => {
    const type = payload.type ?? LessonType.VIDEO;

    if (type === LessonType.TEXT) {
        return { type, content: payload.content, duration: toSeconds(payload.duration) };
    }
    if (type === LessonType.RESOURCE) {
        return { type, resourceUrl: payload.resourceUrl, duration: 0 };
    }

    // Parsed once at write time so the player never has to re-parse, and so a
    // malformed link is rejected here rather than silently failing in the
    // browser.
    const youtubeVideoId = requireYoutubeVideoId(payload.youtubeUrl as string);
    return {
        type,
        youtubeUrl: payload.youtubeUrl,
        youtubeVideoId,
        thumbnail: payload.thumbnail ?? youtubeThumbnailUrl(youtubeVideoId),
        duration: toSeconds(payload.duration),
        isFreePreview: payload.isFreePreview,
    };
};

const createVideo = async (user: IRequestUser, payload: CreatePayload) => {
    const courseModule = await loadModuleForWrite(user, payload.moduleId);

    const fields = typeFields(payload);
    logger.create("Adding lesson", { moduleId: payload.moduleId, type: fields.type });

    const { moduleId, order, title, description, isPublished } = payload;

    const video = await prisma.$transaction(async (tx) => {
        const siblings = await tx.video.findMany({
            where: { moduleId },
            select: { id: true },
            orderBy: { order: "asc" },
        });

        const position = order ? Math.min(order, siblings.length + 1) : siblings.length + 1;

        const created = await tx.video.create({
            data: {
                ...fields,
                title,
                description,
                isPublished,
                moduleId,
                courseId: courseModule.courseId,
                order: siblings.length + 1,
            },
        });

        if (position <= siblings.length) {
            const ids = siblings.map((s) => s.id);
            ids.splice(position - 1, 0, created.id);
            await applyOrdering(ids, (id, newOrder) =>
                tx.video.update({ where: { id }, data: { order: newOrder } }),
            );
        }

        return tx.video.findUniqueOrThrow({ where: { id: created.id } });
    });

    // A newly published video enlarges the course's denominator, so every
    // student's percentage is now stale.
    if (payload.isPublished) scheduleCourseRecalculation(courseModule.courseId);

    return video;
};

const bulkCreateVideos = async (
    user: IRequestUser,
    payload: {
        moduleId: string;
        isPublished?: boolean;
        videos: Array<{ title: string; youtubeUrl: string; duration?: string | number; description?: string }>;
    },
) => {
    const courseModule = await loadModuleForWrite(user, payload.moduleId);

    // Validate every link before writing any of them, so a typo in the last
    // row doesn't leave a half-imported module behind.
    const prepared = payload.videos.map((video) => {
        const youtubeVideoId = requireYoutubeVideoId(video.youtubeUrl);
        return {
            title: video.title,
            description: video.description,
            youtubeUrl: video.youtubeUrl,
            youtubeVideoId,
            thumbnail: youtubeThumbnailUrl(youtubeVideoId),
            duration: toSeconds(video.duration),
        };
    });

    const videos = await prisma.$transaction(async (tx) => {
        const lastOrder = await tx.video.aggregate({
            where: { moduleId: payload.moduleId },
            _max: { order: true },
        });
        const startAt = (lastOrder._max.order ?? 0) + 1;

        await tx.video.createMany({
            data: prepared.map((video, index) => ({
                ...video,
                moduleId: payload.moduleId,
                courseId: courseModule.courseId,
                isPublished: payload.isPublished ?? false,
                order: startAt + index,
            })),
        });

        return tx.video.findMany({ where: { moduleId: payload.moduleId }, orderBy: { order: "asc" } });
    });

    if (payload.isPublished) scheduleCourseRecalculation(courseModule.courseId);

    return videos;
};

const updateVideo = async (
    user: IRequestUser,
    videoId: string,
    payload: Record<string, unknown>,
) => {
    const video = await prisma.video.findUnique({
        where: { id: videoId },
        select: { courseId: true, type: true },
    });
    if (!video) throw new AppError(status.NOT_FOUND, "Lesson not found.");

    await assertCanManageCourse(user, video.courseId);

    // The type is fixed at creation, so a field belonging to another type is
    // a client bug — refuse it rather than store a second payload.
    const isVideo = video.type === LessonType.VIDEO;
    if (payload.youtubeUrl !== undefined && !isVideo) {
        throw new AppError(status.BAD_REQUEST, "Only a video lesson has a YouTube link.");
    }
    if (payload.content !== undefined && video.type !== LessonType.TEXT) {
        throw new AppError(status.BAD_REQUEST, "Only a text lesson has lesson text.");
    }
    if (payload.resourceUrl !== undefined && video.type !== LessonType.RESOURCE) {
        throw new AppError(status.BAD_REQUEST, "Only a resource lesson has a resource link.");
    }
    if (payload.isFreePreview === true && !isVideo) {
        throw new AppError(status.BAD_REQUEST, "Only video lessons can be free previews.");
    }

    const data: Record<string, unknown> = { ...payload };

    if (typeof payload.youtubeUrl === "string") {
        const youtubeVideoId = requireYoutubeVideoId(payload.youtubeUrl);
        data.youtubeVideoId = youtubeVideoId;
        // Only refresh the thumbnail when the caller isn't setting a custom one.
        if (payload.thumbnail === undefined) {
            data.thumbnail = youtubeThumbnailUrl(youtubeVideoId);
        }
    }

    if (payload.duration !== undefined) {
        data.duration = video.type === LessonType.RESOURCE ? 0 : toSeconds(payload.duration as string | number);
    }

    const updated = await prisma.video.update({ where: { id: videoId }, data });

    // Toggling visibility changes what counts toward completion.
    if (payload.isPublished !== undefined) scheduleCourseRecalculation(video.courseId);

    return updated;
};

const deleteVideo = async (user: IRequestUser, videoId: string) => {
    const video = await prisma.video.findUnique({
        where: { id: videoId },
        select: { courseId: true, moduleId: true },
    });
    if (!video) throw new AppError(status.NOT_FOUND, "Lesson not found.");

    await assertCanManageCourse(user, video.courseId);
    logger.delete("Deleting lesson", { videoId });

    await prisma.$transaction(async (tx) => {
        await tx.video.delete({ where: { id: videoId } });

        const remaining = await tx.video.findMany({
            where: { moduleId: video.moduleId },
            orderBy: { order: "asc" },
            select: { id: true },
        });

        await applyOrdering(remaining.map((v) => v.id), (id, order) =>
            tx.video.update({ where: { id }, data: { order } }),
        );
    });

    scheduleCourseRecalculation(video.courseId);
};

const reorderVideos = async (user: IRequestUser, moduleId: string, orderedIds: string[]) => {
    await loadModuleForWrite(user, moduleId);

    return prisma.$transaction(async (tx) => {
        const existing = await tx.video.findMany({ where: { moduleId }, select: { id: true } });

        assertCompleteOrdering(orderedIds, existing.map((v) => v.id));

        await applyOrdering(orderedIds, (id, order) =>
            tx.video.update({ where: { id }, data: { order } }),
        );

        return tx.video.findMany({ where: { moduleId }, orderBy: { order: "asc" } });
    });
};

const getVideosByModule = async (user: IRequestUser, moduleId: string) => {
    await loadModuleForWrite(user, moduleId);
    return prisma.video.findMany({ where: { moduleId }, orderBy: { order: "asc" } });
};

/**
 * Publishes or unpublishes a set of videos in one call — the natural follow-up
 * to a bulk import, and to "hide this module while I re-record it".
 */
const bulkSetPublished = async (
    user: IRequestUser,
    payload: { videoIds: string[]; isPublished: boolean },
) => {
    const videos = await prisma.video.findMany({
        where: { id: { in: payload.videoIds } },
        select: { id: true, courseId: true },
    });

    if (videos.length !== payload.videoIds.length) {
        throw new AppError(status.NOT_FOUND, "One or more of those videos no longer exist.");
    }

    // A batch may legitimately span modules, but every course it touches must
    // be one this user can manage — otherwise a mentor could slip another
    // course's video id into the list.
    const courseIds = [...new Set(videos.map((v) => v.courseId))];
    for (const courseId of courseIds) {
        await assertCanManageCourse(user, courseId);
    }

    const { count } = await prisma.video.updateMany({
        where: { id: { in: payload.videoIds } },
        data: { isPublished: payload.isPublished },
    });

    logger.update("Bulk video publish state changed", { count, isPublished: payload.isPublished });

    for (const courseId of courseIds) scheduleCourseRecalculation(courseId);

    return { count };
};

export const VideoService = {
    createVideo,
    bulkCreateVideos,
    updateVideo,
    deleteVideo,
    reorderVideos,
    getVideosByModule,
    bulkSetPublished,
};
