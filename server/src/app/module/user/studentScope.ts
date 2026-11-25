import status from "http-status";
import AppError from "../../errorHelpers/AppError";
import { learnerScope } from "../../lib/learningProfile";
import { prisma } from "../../lib/prisma";
import { Role } from "../../lib/roles";

/** A 404 unless `userId` is a student — what every part of the admin's student page checks first. */
export const assertStudent = async (userId: string) => {
    const student = await prisma.user.findFirst({
        where: { id: userId, ...learnerScope(Role.STUDENT) },
        select: { id: true },
    });
    if (!student) throw new AppError(status.NOT_FOUND, "Student not found.");
};
