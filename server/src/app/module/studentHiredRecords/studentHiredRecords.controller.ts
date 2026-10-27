import { Request, Response } from "express";
import status from "http-status";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { StudentHiredRecordsService } from "./studentHiredRecords.service";

const getMyHiredRecords = catchAsync(async (req: Request, res: Response) => {
    const result = await StudentHiredRecordsService.getMyHiredRecords(req.user);
    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Hired records fetched successfully",
        data: result,
    });
});

const createHiredRecord = catchAsync(async (req: Request, res: Response) => {
    const result = await StudentHiredRecordsService.createHiredRecord(req.user, req.body);
    sendResponse(res, {
        httpStatusCode: status.CREATED,
        success: true,
        message: "Hired record added successfully",
        data: result,
    });
});

const updateHiredRecord = catchAsync(async (req: Request, res: Response) => {
    const result = await StudentHiredRecordsService.updateHiredRecord(
        req.user,
        req.params.hiredRecordId as string,
        req.body,
    );
    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Hired record updated successfully",
        data: result,
    });
});

const deleteHiredRecord = catchAsync(async (req: Request, res: Response) => {
    await StudentHiredRecordsService.deleteHiredRecord(
        req.user,
        req.params.hiredRecordId as string,
    );
    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Hired record removed successfully",
        data: null,
    });
});

export const StudentHiredRecordsController = {
    getMyHiredRecords,
    createHiredRecord,
    updateHiredRecord,
    deleteHiredRecord,
};
