import status from "http-status";
import { LessonType } from "../../../generated/prisma/enums";
import AppError from "../../errorHelpers/AppError";
import { IRequestUser } from "../../interfaces/requestUser.interface";
import { prisma } from "../../lib/prisma";
import { assertCanManageCourse } from "../../utils/courseAccess";
import { logger } from "../../utils/logger";
import { applyOrdering, assertCompleteOrdering } from "../../utils/ordering";
import { requireYoutubeVideoId } from "../../utils/youtube";

/**
 * The lessons that come with an assignment — authoring side. Students read
 * them through the assignment itself (`AssignmentService.getAssignmentForStudent`),
 * so they're visible exactly when the assignment is published.
 */

const loadAssignmentForWrite = async (user: IRequestUser, assignmentId: string) => {
    const assignment = await prisma.assignment.findUnique({
        where: { id: assignmentId },
        select: { id: true, courseId: true },
    });
    if (!assignment) throw new AppError(status.NOT_FOUND, "Assignment not found.");

    await assertCanManageCourse(user, assignment.courseId);
    return assignment;
};

type CreatePayload = {
    assignmentId: string;
    type: LessonType;
    title: string;
    description?: string;
    youtubeUrl?: string;
    content?: string;
    resourceUrl?: string;
};

/** Only the columns this type uses — same rule as module lessons. */
const typeFields = (payload: CreatePayload) => {
    if (payload.type === LessonType.TEXT) return { type: payload.type, content: payload.content };
    if (payload.type === LessonType.RESOURCE) return { type: payload.type, resourceUrl: payload.resourceUrl };
    return {
        type: payload.type,
        youtubeUrl: payload.youtubeUrl,
        youtubeVideoId: requireYoutubeVideoId(payload.youtubeUrl as string),
    };
};

const getMaterials = async (user: IRequestUser, assignmentId: string) => {
    await loadAssignmentForWrite(user, assignmentId);
    return prisma.assignmentMaterial.findMany({ where: { assignmentId }, orderBy: { order: "asc" } });
};

const createMaterial = async (user: IRequestUser, payload: CreatePayload) => {
    const assignment = await loadAssignmentForWrite(user, payload.assignmentId);
    const fields = typeFields(payload);

    // Appended; positions stay 1..n because delete and reorder close gaps.
    return prisma.$transaction(async (tx) => {
        const count = await tx.assignmentMaterial.count({ where: { assignmentId: assignment.id } });
        return tx.assignmentMaterial.create({
            data: {
                ...fields,
                assignmentId: assignment.id,
                courseId: assignment.courseId,
                title: payload.title,
                description: payload.description,
                order: count + 1,
            },
        });
    });
};

const loadMaterialForWrite = async (user: IRequestUser, materialId: string) => {
    const material = await prisma.assignmentMaterial.findUnique({
        where: { id: materialId },
        select: { id: true, courseId: true, assignmentId: true, type: true },
    });
    if (!material) throw new AppError(status.NOT_FOUND, "Lesson not found.");

    await assertCanManageCourse(user, material.courseId);
    return material;
};

const updateMaterial = async (
    user: IRequestUser,
    materialId: string,
    payload: { title?: string; description?: string; youtubeUrl?: string; content?: string; resourceUrl?: string },
) => {
    const material = await loadMaterialForWrite(user, materialId);

    // The type is fixed at creation — a field belonging to another type is a
    // client bug, refused rather than stored alongside the real one.
    if (payload.youtubeUrl !== undefined && material.type !== LessonType.VIDEO) {
        throw new AppError(status.BAD_REQUEST, "Only a video lesson has a YouTube link.");
    }
    if (payload.content !== undefined && material.type !== LessonType.TEXT) {
        throw new AppError(status.BAD_REQUEST, "Only a text lesson has lesson text.");
    }
    if (payload.resourceUrl !== undefined && material.type !== LessonType.RESOURCE) {
        throw new AppError(status.BAD_REQUEST, "Only a resource lesson has a resource link.");
    }

    return prisma.assignmentMaterial.update({
        where: { id: materialId },
        data: {
            ...payload,
            ...(payload.youtubeUrl !== undefined ? { youtubeVideoId: requireYoutubeVideoId(payload.youtubeUrl) } : {}),
        },
    });
};

const deleteMaterial = async (user: IRequestUser, materialId: string) => {
    const material = await loadMaterialForWrite(user, materialId);
    logger.delete("Deleting assignment lesson", { materialId });

    await prisma.$transaction(async (tx) => {
        await tx.assignmentMaterial.delete({ where: { id: materialId } });

        const remaining = await tx.assignmentMaterial.findMany({
            where: { assignmentId: material.assignmentId },
            orderBy: { order: "asc" },
            select: { id: true },
        });
        await applyOrdering(remaining.map((m) => m.id), (id, order) =>
            tx.assignmentMaterial.update({ where: { id }, data: { order } }),
        );
    });
};

const reorderMaterials = async (user: IRequestUser, assignmentId: string, orderedIds: string[]) => {
    await loadAssignmentForWrite(user, assignmentId);

    return prisma.$transaction(async (tx) => {
        const existing = await tx.assignmentMaterial.findMany({ where: { assignmentId }, select: { id: true } });
        assertCompleteOrdering(orderedIds, existing.map((m) => m.id));

        await applyOrdering(orderedIds, (id, order) =>
            tx.assignmentMaterial.update({ where: { id }, data: { order } }),
        );

        return tx.assignmentMaterial.findMany({ where: { assignmentId }, orderBy: { order: "asc" } });
    });
};

export const AssignmentMaterialService = {
    getMaterials,
    createMaterial,
    updateMaterial,
    deleteMaterial,
    reorderMaterials,
};
