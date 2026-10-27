import status from "http-status";
import AppError from "../../errorHelpers/AppError";
import { IRequestUser } from "../../interfaces/requestUser.interface";
import { prisma } from "../../lib/prisma";

const getMyProjects = (user: IRequestUser) =>
    prisma.studentProject.findMany({
        where: { userId: user.userId },
        orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    });

const createProject = async (
    user: IRequestUser,
    payload: { title: string; description?: string; url: string },
) => {
    const count = await prisma.studentProject.count({ where: { userId: user.userId } });
    return prisma.studentProject.create({
        data: { ...payload, userId: user.userId, order: count },
    });
};

const updateProject = async (
    user: IRequestUser,
    projectId: string,
    payload: { title?: string; description?: string; url?: string },
) => {
    const project = await prisma.studentProject.findUnique({ where: { id: projectId } });
    if (!project || project.userId !== user.userId) {
        throw new AppError(status.NOT_FOUND, "Project not found.");
    }

    return prisma.studentProject.update({ where: { id: projectId }, data: payload });
};

const deleteProject = async (user: IRequestUser, projectId: string) => {
    const project = await prisma.studentProject.findUnique({ where: { id: projectId } });
    if (!project || project.userId !== user.userId) {
        throw new AppError(status.NOT_FOUND, "Project not found.");
    }

    await prisma.studentProject.delete({ where: { id: projectId } });
};

export const StudentProjectsService = {
    getMyProjects,
    createProject,
    updateProject,
    deleteProject,
};
