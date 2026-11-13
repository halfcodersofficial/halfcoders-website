import status from "http-status";
import AppError from "../../errorHelpers/AppError";
import { IRequestUser } from "../../interfaces/requestUser.interface";
import { prisma } from "../../lib/prisma";
import { assertCanManageCourse } from "../../utils/courseAccess";
import { type MaterialFields, materialTypeFields, materialUpdateData } from "../../utils/lessonMaterial";
import { logger } from "../../utils/logger";
import { applyOrdering, assertCompleteOrdering } from "../../utils/ordering";

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

type CreatePayload = MaterialFields & {
    assignmentId: string;
    title: string;
    description?: string;
};

const getMaterials = async (user: IRequestUser, assignmentId: string) => {
    await loadAssignmentForWrite(user, assignmentId);
    return prisma.assignmentMaterial.findMany({ where: { assignmentId }, orderBy: { order: "asc" } });
};

const createMaterial = async (user: IRequestUser, payload: CreatePayload) => {
    const assignment = await loadAssignmentForWrite(user, payload.assignmentId);
    const fields = materialTypeFields(payload);

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

    // The type is fixed at creation — see `materialUpdateData`.
    return prisma.assignmentMaterial.update({
        where: { id: materialId },
        data: materialUpdateData(material.type, payload),
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
