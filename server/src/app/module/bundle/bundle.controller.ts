import { Request, Response } from "express";
import status from "http-status";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { BundleService } from "./bundle.service";

const ok = (res: Response, message: string, data: unknown, httpStatusCode: number = status.OK) =>
    sendResponse(res, { httpStatusCode, success: true, message, data });

const param = (req: Request, name: string) => req.params[name] as string;

// Public
const getPublicBundles = catchAsync(async (req: Request, res: Response) =>
    ok(res, "Bundles retrieved", await BundleService.getPublicBundles(req.user)),
);
const getPublicBundle = catchAsync(async (req: Request, res: Response) =>
    ok(res, "Bundle retrieved", await BundleService.getPublicBundle(param(req, "slug"), req.user)),
);

// Student checkout
const createBundleOrder = catchAsync(async (req: Request, res: Response) =>
    ok(res, "Bundle order ready", await BundleService.createBundleOrder(req.user, param(req, "bundleId")), status.CREATED),
);
const getMyBundleOrder = catchAsync(async (req: Request, res: Response) =>
    ok(res, "Bundle order retrieved", await BundleService.getMyBundleOrder(req.user, param(req, "bundleOrderId"))),
);
const submitBkashBundlePayment = catchAsync(async (req: Request, res: Response) =>
    ok(
        res,
        "Payment details received. We'll verify them and open the courses.",
        await BundleService.submitBkashBundlePayment(req.user, param(req, "bundleOrderId"), req.body),
    ),
);

// Admin
const listBundles = catchAsync(async (_req: Request, res: Response) => ok(res, "Bundles retrieved", await BundleService.listBundles()));
const createBundle = catchAsync(async (req: Request, res: Response) =>
    ok(res, "Bundle created", await BundleService.createBundle(req.body), status.CREATED),
);
const updateBundle = catchAsync(async (req: Request, res: Response) =>
    ok(res, "Bundle updated", await BundleService.updateBundle(param(req, "bundleId"), req.body)),
);
const deleteBundle = catchAsync(async (req: Request, res: Response) => {
    await BundleService.deleteBundle(param(req, "bundleId"));
    ok(res, "Bundle deleted", null);
});
const listBundleOrders = catchAsync(async (req: Request, res: Response) =>
    ok(res, "Bundle orders retrieved", await BundleService.listBundleOrders(param(req, "bundleId"))),
);
const markBundlePaid = catchAsync(async (req: Request, res: Response) =>
    ok(res, "Bundle order settled", await BundleService.markBundlePaid(req.user, param(req, "bundleOrderId"))),
);
const rejectBundleOrder = catchAsync(async (req: Request, res: Response) =>
    ok(res, "Bundle order turned down", await BundleService.rejectBundleOrder(param(req, "bundleOrderId"), req.body.reason)),
);
const refundBundleOrder = catchAsync(async (req: Request, res: Response) =>
    ok(res, "Bundle order refunded", await BundleService.refundBundleOrder(param(req, "bundleOrderId"), req.body.reason)),
);

export const BundleController = {
    getPublicBundles,
    getPublicBundle,
    createBundleOrder,
    getMyBundleOrder,
    submitBkashBundlePayment,
    listBundles,
    createBundle,
    updateBundle,
    deleteBundle,
    listBundleOrders,
    markBundlePaid,
    rejectBundleOrder,
    refundBundleOrder,
};
