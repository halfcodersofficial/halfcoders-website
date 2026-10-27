import { Request, Response } from "express";
import status from "http-status";
import { IQueryParams } from "../../interfaces/query.interface";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { OrderService } from "./order.service";
import { sendCsv } from "../../utils/csvExport";

const createOrder = catchAsync(async (req: Request, res: Response) => {
    const result = await OrderService.createOrder(req.user, req.body);

    sendResponse(res, {
        httpStatusCode: status.CREATED,
        success: true,
        message: result.status === "PAID"
            ? "Enrolled successfully"
            : "Order created. Complete the payment to unlock the course.",
        data: result,
    });
});

const submitBkashPayment = catchAsync(async (req: Request, res: Response) => {
    const result = await OrderService.submitBkashPayment(req.user, req.params.orderId as string, req.body);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Payment details received. We'll verify them and open the course.",
        data: result,
    });
});

const getMyOrders = catchAsync(async (req: Request, res: Response) => {
    const result = await OrderService.getMyOrders(req.user, req.query as IQueryParams);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Orders fetched successfully",
        data: result.data,
        meta: result.meta,
    });
});

const getMyOrder = catchAsync(async (req: Request, res: Response) => {
    const result = await OrderService.getMyOrder(req.user, req.params.orderId as string);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Order fetched successfully",
        data: result,
    });
});

const downloadMyInvoice = catchAsync(async (req: Request, res: Response) => {
    const { pdf, orderNumber } = await OrderService.downloadMyInvoice(req.user, req.params.orderId as string);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="Invoice-${orderNumber}.pdf"`);
    res.setHeader("Content-Length", pdf.length);
    res.send(pdf);
});

const getAllOrders = catchAsync(async (req: Request, res: Response) => {
    const result = await OrderService.getAllOrders(req.query as IQueryParams);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Orders fetched successfully",
        data: result.data,
        meta: result.meta,
    });
});

const getOrderCourses = catchAsync(async (req: Request, res: Response) => {
    const result = await OrderService.getOrderCourses(req.query as IQueryParams);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Order courses fetched successfully",
        data: result,
    });
});

const getOrderCourse = catchAsync(async (req: Request, res: Response) => {
    const result = await OrderService.getOrderCourse(req.params.courseId as string);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Order course fetched successfully",
        data: result,
    });
});

const markOrderPaid = catchAsync(async (req: Request, res: Response) => {
    const result = await OrderService.markOrderPaid({
        orderId: req.params.orderId as string,
        gateway: req.body.gateway,
        transactionId: req.body.transactionId,
        gatewayData: req.body.gatewayData,
        actorId: req.user.userId,
    });

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Payment confirmed and student enrolled",
        data: result,
    });
});

const markOrderFailed = catchAsync(async (req: Request, res: Response) => {
    const result = await OrderService.markOrderFailed({
        orderId: req.params.orderId as string,
        reason: req.body.reason,
    });

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Order marked as failed",
        data: result,
    });
});

const refundOrder = catchAsync(async (req: Request, res: Response) => {
    const result = await OrderService.refundOrder(req.params.orderId as string, req.body.reason);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Order refunded and enrolment cancelled",
        data: result,
    });
});

const exportOrders = catchAsync(async (req: Request, res: Response) => {
    sendCsv(res, "orders", await OrderService.exportOrders(req.query as IQueryParams));
});

const applyCoupon = catchAsync(async (req: Request, res: Response) => {
    const result = await OrderService.setOrderCoupon(req.user, req.params.orderId as string, req.body.code);
    sendResponse(res, { httpStatusCode: status.OK, success: true, message: "Coupon applied", data: result });
});

const removeCoupon = catchAsync(async (req: Request, res: Response) => {
    const result = await OrderService.setOrderCoupon(req.user, req.params.orderId as string, null);
    sendResponse(res, { httpStatusCode: status.OK, success: true, message: "Coupon removed", data: result });
});

export const OrderController = {
    applyCoupon,
    removeCoupon,
    exportOrders,
    createOrder,
    submitBkashPayment,
    getMyOrders,
    getMyOrder,
    downloadMyInvoice,
    getAllOrders,
    getOrderCourses,
    getOrderCourse,
    markOrderPaid,
    markOrderFailed,
    refundOrder,
};
