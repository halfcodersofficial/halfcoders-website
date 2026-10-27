import status from "http-status";
import AppError from "../../errorHelpers/AppError";
import { IRequestUser } from "../../interfaces/requestUser.interface";
import { prisma } from "../../lib/prisma";

const getMyJobExperiences = (user: IRequestUser) =>
    prisma.studentJobExperience.findMany({
        where: { userId: user.userId },
        orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    });

const createJobExperience = async (
    user: IRequestUser,
    payload: {
        designation: string;
        companyName: string;
        isRelatedToIt?: boolean;
        description?: string;
        isCurrentlyWorking?: boolean;
        startDate?: Date;
        endDate?: Date;
    },
) => {
    const count = await prisma.studentJobExperience.count({ where: { userId: user.userId } });
    return prisma.studentJobExperience.create({
        data: { ...payload, userId: user.userId, order: count },
    });
};

const updateJobExperience = async (
    user: IRequestUser,
    experienceId: string,
    payload: {
        designation?: string;
        companyName?: string;
        isRelatedToIt?: boolean;
        description?: string;
        isCurrentlyWorking?: boolean;
        startDate?: Date;
        endDate?: Date;
    },
) => {
    const experience = await prisma.studentJobExperience.findUnique({
        where: { id: experienceId },
    });
    if (!experience || experience.userId !== user.userId) {
        throw new AppError(status.NOT_FOUND, "Job experience not found.");
    }

    return prisma.studentJobExperience.update({ where: { id: experienceId }, data: payload });
};

const deleteJobExperience = async (user: IRequestUser, experienceId: string) => {
    const experience = await prisma.studentJobExperience.findUnique({
        where: { id: experienceId },
    });
    if (!experience || experience.userId !== user.userId) {
        throw new AppError(status.NOT_FOUND, "Job experience not found.");
    }

    await prisma.studentJobExperience.delete({ where: { id: experienceId } });
};

export const StudentJobExperiencesService = {
    getMyJobExperiences,
    createJobExperience,
    updateJobExperience,
    deleteJobExperience,
};
