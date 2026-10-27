import { IRequestUser } from "../../interfaces/requestUser.interface";
import { NotificationType } from "../../../generated/prisma/enums";
import { prisma } from "../../lib/prisma";
import { notifyAdmins } from "../notification/notification.service";

const getMyCourseRequests = (user: IRequestUser) =>
    prisma.studentCourseRequest.findMany({
        where: { userId: user.userId },
        orderBy: { createdAt: "desc" },
    });

/**
 * A student asking for a course Half Coders doesn't run yet. Admins hear about it
 * straight away — it's demand they'd otherwise only find on the student's
 * profile — with a link to that profile, where every request is listed.
 */
const createCourseRequest = async (
    user: IRequestUser,
    payload: { courseName: string; category?: string },
) => {
    const request = await prisma.studentCourseRequest.create({
        data: { ...payload, userId: user.userId },
    });

    const student = await prisma.user.findUnique({ where: { id: user.userId }, select: { name: true } });
    await notifyAdmins({
        title: `Course request: ${payload.courseName}`,
        message: `${student?.name ?? "A student"} would like a course on "${payload.courseName}"${
            payload.category ? ` (${payload.category})` : ""
        }.`,
        type: NotificationType.COURSE,
        link: `/admin/students/${user.userId}?tab=profile`,
    });

    return request;
};

export const StudentCourseRequestsService = {
    getMyCourseRequests,
    createCourseRequest,
};
