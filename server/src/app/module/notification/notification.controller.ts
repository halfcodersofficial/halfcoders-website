import { Request, Response } from "express";
import status from "http-status";
import { IQueryParams } from "../../interfaces/query.interface";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { NotificationService } from "./notification.service";

const getMyNotifications = catchAsync(async (req: Request, res: Response) => {
    const result = await NotificationService.getMyNotifications(req.user, req.query as IQueryParams);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Notifications fetched successfully",
        data: result.data,
        meta: result.meta,
    });
});

const getUnreadCount = catchAsync(async (req: Request, res: Response) => {
    const unread = await NotificationService.getUnreadCount(req.user);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Unread count fetched successfully",
        data: unread,
    });
});

const markAsRead = catchAsync(async (req: Request, res: Response) => {
    await NotificationService.markAsRead(req.user, req.params.notificationId as string);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Notification marked as read",
        data: null,
    });
});

const markAsUnread = catchAsync(async (req: Request, res: Response) => {
    await NotificationService.markAsUnread(req.user, req.params.notificationId as string);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Notification marked as unread",
        data: null,
    });
});

const markAllAsRead = catchAsync(async (req: Request, res: Response) => {
    const count = await NotificationService.markAllAsRead(req.user);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: `${count} notification(s) marked as read`,
        data: { count },
    });
});

const deleteNotification = catchAsync(async (req: Request, res: Response) => {
    await NotificationService.deleteNotification(req.user, req.params.notificationId as string);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Notification deleted successfully",
        data: null,
    });
});

const deleteRead = catchAsync(async (req: Request, res: Response) => {
    const count = await NotificationService.deleteRead(req.user);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: `${count} read notification(s) deleted`,
        data: { count },
    });
});

const getLoginPopups = catchAsync(async (req: Request, res: Response) => {
    const popups = await NotificationService.getLoginPopups(req.user);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Login pop-ups fetched successfully",
        data: popups,
    });
});

const getLivePopups = catchAsync(async (_req: Request, res: Response) => {
    const popups = await NotificationService.getLivePopups();

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Live pop-ups fetched successfully",
        data: popups,
    });
});

const stopPopup = catchAsync(async (req: Request, res: Response) => {
    const result = await NotificationService.stopPopup(req.params.notificationId as string);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: `Pop-up stopped for ${result.stopped} recipient(s)`,
        data: result,
    });
});

const getBroadcastAudience = catchAsync(async (_req: Request, res: Response) => {
    const audience = await NotificationService.getBroadcastAudience();

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Broadcast audience fetched successfully",
        data: audience,
    });
});

const broadcast = catchAsync(async (req: Request, res: Response) => {
    const result = await NotificationService.broadcast(req.user, req.body);

    sendResponse(res, {
        httpStatusCode: status.CREATED,
        success: true,
        message: `Notification sent to ${result.recipients} recipient(s)`,
        data: result,
    });
});

export const NotificationController = {
    getMyNotifications,
    getUnreadCount,
    markAsRead,
    markAsUnread,
    markAllAsRead,
    deleteNotification,
    deleteRead,
    getLoginPopups,
    getLivePopups,
    stopPopup,
    getBroadcastAudience,
    broadcast,
};
