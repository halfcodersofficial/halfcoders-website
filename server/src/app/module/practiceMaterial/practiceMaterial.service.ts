import status from "http-status";
import AppError from "../../errorHelpers/AppError";
import { IRequestUser } from "../../interfaces/requestUser.interface";
import { prisma } from "../../lib/prisma";
import { assertCanManageCourse } from "../../utils/courseAccess";
import { type MaterialFields, materialTypeFields, materialUpdateData } from "../../utils/lessonMaterial";
import { logger } from "../../utils/logger";
import { applyOrdering, assertCompleteOrdering } from "../../utils/ordering";

/**
 * The lessons that come with a practice day — videos, texts and links, the
 * same three a module's lessons are — authoring side. Students read them
 * through the practice day itself (`PracticeService.getPracticeDayForStudent`),
 * so they're visible exactly when the practice day is published. Built like
 * an assignment's lessons (assignmentMaterial.service.ts).
 */

const loadPracticeDayForWrite = async (user: IRequestUser, practiceDayId: string) => {
    const practiceDay = await prisma.practiceDay.findUnique({
        where: { id: practiceDayId },
        select: { id: true, courseId: true },
    });
    if (!practiceDay) throw new AppError(status.NOT_FOUND, "Practice day not found.");

    await assertCanManageCourse(user, practiceDay.courseId);
    return practiceDay;
};

type CreatePayload = MaterialFields & {
    practiceDayId: string;
    title: string;
    description?: string;
};

const getMaterials = async (user: IRequestUser, practiceDayId: string) => {
    await loadPracticeDayForWrite(user, practiceDayId);
    return prisma.practiceMaterial.findMany({ where: { practiceDayId }, orderBy: { order: "asc" } });
};

const createMaterial = async (user: IRequestUser, payload: CreatePayload) => {
    const practiceDay = await loadPracticeDayForWrite(user, payload.practiceDayId);
    const fields = materialTypeFields(payload);

    // Appended; positions stay 1..n because delete and reorder close gaps.
    return prisma.$transaction(async (tx) => {
        const count = await tx.practiceMaterial.count({ where: { practiceDayId: practiceDay.id } });
        return tx.practiceMaterial.create({
            data: {
                ...fields,
                practiceDayId: practiceDay.id,
                courseId: practiceDay.courseId,
                title: payload.title,
                description: payload.description,
                order: count + 1,
            },
        });
    });
};

const loadMaterialForWrite = async (user: IRequestUser, materialId: string) => {
    const material = await prisma.practiceMaterial.findUnique({
        where: { id: materialId },
        select: { id: true, courseId: true, practiceDayId: true, type: true },
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
    return prisma.practiceMaterial.update({ where: { id: materialId }, data: materialUpdateData(material.type, payload) });
};

const deleteMaterial = async (user: IRequestUser, materialId: string) => {
    const material = await loadMaterialForWrite(user, materialId);
    logger.delete("Deleting practice day lesson", { materialId });

    await prisma.$transaction(async (tx) => {
        await tx.practiceMaterial.delete({ where: { id: materialId } });

        const remaining = await tx.practiceMaterial.findMany({
            where: { practiceDayId: material.practiceDayId },
            orderBy: { order: "asc" },
            select: { id: true },
        });
        await applyOrdering(remaining.map((m) => m.id), (id, order) =>
            tx.practiceMaterial.update({ where: { id }, data: { order } }),
        );
    });
};

const reorderMaterials = async (user: IRequestUser, practiceDayId: string, orderedIds: string[]) => {
    await loadPracticeDayForWrite(user, practiceDayId);

    return prisma.$transaction(async (tx) => {
        const existing = await tx.practiceMaterial.findMany({ where: { practiceDayId }, select: { id: true } });
        assertCompleteOrdering(orderedIds, existing.map((m) => m.id));

        await applyOrdering(orderedIds, (id, order) =>
            tx.practiceMaterial.update({ where: { id }, data: { order } }),
        );

        return tx.practiceMaterial.findMany({ where: { practiceDayId }, orderBy: { order: "asc" } });
    });
};

export const PracticeMaterialService = {
    getMaterials,
    createMaterial,
    updateMaterial,
    deleteMaterial,
    reorderMaterials,
};
