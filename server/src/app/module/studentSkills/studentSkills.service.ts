import status from "http-status";
import AppError from "../../errorHelpers/AppError";
import { IRequestUser } from "../../interfaces/requestUser.interface";
import { prisma } from "../../lib/prisma";

const getMySkills = (user: IRequestUser) =>
    prisma.studentSkill.findMany({
        where: { userId: user.userId },
        orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    });

const createSkill = async (
    user: IRequestUser,
    payload: { name: string; yearsOfExperience?: string; projectLink?: string },
) => {
    const count = await prisma.studentSkill.count({ where: { userId: user.userId } });
    return prisma.studentSkill.create({
        data: { ...payload, userId: user.userId, order: count },
    });
};

const updateSkill = async (
    user: IRequestUser,
    skillId: string,
    payload: { name?: string; yearsOfExperience?: string; projectLink?: string },
) => {
    const skill = await prisma.studentSkill.findUnique({ where: { id: skillId } });
    if (!skill || skill.userId !== user.userId) {
        throw new AppError(status.NOT_FOUND, "Skill not found.");
    }

    return prisma.studentSkill.update({ where: { id: skillId }, data: payload });
};

const deleteSkill = async (user: IRequestUser, skillId: string) => {
    const skill = await prisma.studentSkill.findUnique({ where: { id: skillId } });
    if (!skill || skill.userId !== user.userId) {
        throw new AppError(status.NOT_FOUND, "Skill not found.");
    }

    await prisma.studentSkill.delete({ where: { id: skillId } });
};

export const StudentSkillsService = {
    getMySkills,
    createSkill,
    updateSkill,
    deleteSkill,
};
