import status from "http-status";
import z from "zod";
import { LessonType } from "../../generated/prisma/enums";
import AppError from "../errorHelpers/AppError";
import { requireYoutubeVideoId } from "./youtube";

/*
 * The lessons that come with an assignment or a practice day — a video, a
 * written text or a link, the same three a module's lessons are. What they
 * share: the fields each type takes, and the rule that a lesson's type is
 * fixed once it exists.
 */

/** Same limits as module lessons (see video.validation.ts). */
const lessonContent = z.string().trim().min(1, "Write the lesson text").max(50_000);

/** Only http(s) — this lands in an `<a href>` on the student's page. */
const resourceUrl = z
    .string()
    .trim()
    .max(2000)
    .regex(/^https?:\/\/\S+$/i, "Enter a full link starting with https://");

/** A new lesson's own fields; the caller adds what it belongs to. */
export const materialCreateFields = {
    type: z.enum(["VIDEO", "TEXT", "RESOURCE"]),
    title: z.string().trim().min(3, "Title must be at least 3 characters").max(200),
    description: z.string().trim().max(2000).optional(),
    youtubeUrl: z.string().trim().min(1).optional(),
    content: lessonContent.optional(),
    resourceUrl: resourceUrl.optional(),
};

/** Each type needs its own field. */
export const requireFieldForType = (
    lesson: { type: "VIDEO" | "TEXT" | "RESOURCE"; youtubeUrl?: string; content?: string; resourceUrl?: string },
    ctx: z.RefinementCtx,
) => {
    if (lesson.type === "VIDEO" && !lesson.youtubeUrl) {
        ctx.addIssue({ code: "custom", path: ["youtubeUrl"], message: "YouTube URL is required" });
    }
    if (lesson.type === "TEXT" && !lesson.content) {
        ctx.addIssue({ code: "custom", path: ["content"], message: "Write the lesson text" });
    }
    if (lesson.type === "RESOURCE" && !lesson.resourceUrl) {
        ctx.addIssue({ code: "custom", path: ["resourceUrl"], message: "Add the resource link" });
    }
};

/** An edit: the type is fixed once created, so a field of another type is refused (`assertFieldsMatchType`). */
export const materialUpdateZodSchema = z.object({
    title: z.string().trim().min(3).max(200).optional(),
    description: z.string().trim().max(2000).optional(),
    youtubeUrl: z.string().trim().min(1).optional(),
    content: lessonContent.optional(),
    resourceUrl: resourceUrl.optional(),
});

export const materialReorderZodSchema = z.object({
    orderedIds: z.array(z.string().trim().min(1)).min(1, "Provide at least one id"),
});

export type MaterialFields = {
    type: LessonType;
    youtubeUrl?: string;
    content?: string;
    resourceUrl?: string;
};

/** Only the columns this type uses — same rule as module lessons. */
export const materialTypeFields = (payload: MaterialFields) => {
    if (payload.type === LessonType.TEXT) return { type: payload.type, content: payload.content };
    if (payload.type === LessonType.RESOURCE) return { type: payload.type, resourceUrl: payload.resourceUrl };
    return {
        type: payload.type,
        youtubeUrl: payload.youtubeUrl,
        youtubeVideoId: requireYoutubeVideoId(payload.youtubeUrl as string),
    };
};

/**
 * An edit's fields against the lesson's fixed type — a field belonging to
 * another type is a client bug, refused rather than stored alongside the real
 * one. Returns the data to write, with the video id worked out from a new link.
 */
export const materialUpdateData = <T extends { youtubeUrl?: string; content?: string; resourceUrl?: string }>(type: LessonType, payload: T) => {
    if (payload.youtubeUrl !== undefined && type !== LessonType.VIDEO) {
        throw new AppError(status.BAD_REQUEST, "Only a video lesson has a YouTube link.");
    }
    if (payload.content !== undefined && type !== LessonType.TEXT) {
        throw new AppError(status.BAD_REQUEST, "Only a text lesson has lesson text.");
    }
    if (payload.resourceUrl !== undefined && type !== LessonType.RESOURCE) {
        throw new AppError(status.BAD_REQUEST, "Only a resource lesson has a resource link.");
    }
    return {
        ...payload,
        ...(payload.youtubeUrl !== undefined ? { youtubeVideoId: requireYoutubeVideoId(payload.youtubeUrl) } : {}),
    };
};
