import { Request, Response } from "express";
import status from "http-status";
import { IQueryParams } from "../../interfaces/query.interface";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { CertificateService } from "./certificate.service";
import { sendCsv } from "../../utils/csvExport";

const claimCertificate = catchAsync(async (req: Request, res: Response) => {
    const result = await CertificateService.claimCertificate(req.user, req.params.courseId as string);

    sendResponse(res, {
        httpStatusCode: status.CREATED,
        success: true,
        message: "Certificate issued. Congratulations!",
        data: result,
    });
});

const getMyEligibility = catchAsync(async (req: Request, res: Response) => {
    const result = await CertificateService.getMyEligibility(req.user, req.params.courseId as string);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: result.eligible
            ? "You're eligible for this certificate"
            : "Not eligible yet",
        data: result,
    });
});

const getMyCertificates = catchAsync(async (req: Request, res: Response) => {
    const result = await CertificateService.getMyCertificates(req.user, req.query as IQueryParams);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Certificates fetched successfully",
        data: result.data,
        meta: result.meta,
    });
});

const verifyCertificate = catchAsync(async (req: Request, res: Response) => {
    const result = await CertificateService.verifyCertificate(req.params.certificateNo as string);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: result.valid
            ? "This certificate is valid"
            : "This certificate has been revoked",
        data: result,
    });
});

const getAllCertificates = catchAsync(async (req: Request, res: Response) => {
    const result = await CertificateService.getAllCertificates(req.query as IQueryParams);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Certificates fetched successfully",
        data: result.data,
        meta: result.meta,
    });
});

const revokeCertificate = catchAsync(async (req: Request, res: Response) => {
    const result = await CertificateService.revokeCertificate(
        req.params.certificateId as string,
        req.body.reason,
    );

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Certificate revoked",
        data: result,
    });
});

const restoreCertificate = catchAsync(async (req: Request, res: Response) => {
    const result = await CertificateService.restoreCertificate(req.params.certificateId as string);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Certificate restored",
        data: result,
    });
});

const issueManually = catchAsync(async (req: Request, res: Response) => {
    const result = await CertificateService.issueManually(req.user, req.body);

    sendResponse(res, {
        httpStatusCode: status.CREATED,
        success: true,
        message: "Certificate issued successfully",
        data: result,
    });
});

const downloadCertificate = catchAsync(async (req: Request, res: Response) => {
    const { pdf, certificateNo } = await CertificateService.downloadCertificate(
        req.params.certificateNo as string,
        req.user,
    );

    // `inline` so a click opens it in the browser's viewer; the filename is
    // still what a Save gives them.
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${certificateNo}.pdf"`);
    res.setHeader("Content-Length", pdf.length);
    res.send(pdf);
});

const exportCertificates = catchAsync(async (req: Request, res: Response) => {
    sendCsv(res, "certificates", await CertificateService.exportCertificates(req.query as IQueryParams));
});

export const CertificateController = {
    exportCertificates,
    claimCertificate,
    downloadCertificate,
    getMyEligibility,
    getMyCertificates,
    verifyCertificate,
    getAllCertificates,
    revokeCertificate,
    restoreCertificate,
    issueManually,
};
