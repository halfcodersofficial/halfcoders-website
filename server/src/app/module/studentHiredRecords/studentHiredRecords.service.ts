import status from "http-status";
import AppError from "../../errorHelpers/AppError";
import { IRequestUser } from "../../interfaces/requestUser.interface";
import { prisma } from "../../lib/prisma";

const getMyHiredRecords = (user: IRequestUser) =>
    prisma.studentHiredRecord.findMany({
        where: { userId: user.userId },
        orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    });

const createHiredRecord = async (
    user: IRequestUser,
    payload: {
        companyName: string;
        position: string;
        jobType?: string;
        howGotJob?: string;
        description?: string;
        companyCountry?: string;
        companyCity?: string;
        isCurrentlyWorking?: boolean;
        startDate?: Date;
        endDate?: Date;
        careerImpactNote?: string;
        appointmentLetterUrl?: string;
    },
) => {
    const count = await prisma.studentHiredRecord.count({ where: { userId: user.userId } });
    return prisma.studentHiredRecord.create({
        data: { ...payload, userId: user.userId, order: count },
    });
};

const updateHiredRecord = async (
    user: IRequestUser,
    hiredRecordId: string,
    payload: {
        companyName?: string;
        position?: string;
        jobType?: string;
        howGotJob?: string;
        description?: string;
        companyCountry?: string;
        companyCity?: string;
        isCurrentlyWorking?: boolean;
        startDate?: Date;
        endDate?: Date;
        careerImpactNote?: string;
        appointmentLetterUrl?: string;
    },
) => {
    const hiredRecord = await prisma.studentHiredRecord.findUnique({
        where: { id: hiredRecordId },
    });
    if (!hiredRecord || hiredRecord.userId !== user.userId) {
        throw new AppError(status.NOT_FOUND, "Hired record not found.");
    }

    return prisma.studentHiredRecord.update({ where: { id: hiredRecordId }, data: payload });
};

const deleteHiredRecord = async (user: IRequestUser, hiredRecordId: string) => {
    const hiredRecord = await prisma.studentHiredRecord.findUnique({
        where: { id: hiredRecordId },
    });
    if (!hiredRecord || hiredRecord.userId !== user.userId) {
        throw new AppError(status.NOT_FOUND, "Hired record not found.");
    }

    await prisma.studentHiredRecord.delete({ where: { id: hiredRecordId } });
};

export const StudentHiredRecordsService = {
    getMyHiredRecords,
    createHiredRecord,
    updateHiredRecord,
    deleteHiredRecord,
};
