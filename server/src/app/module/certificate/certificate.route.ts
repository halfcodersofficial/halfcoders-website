import { Router } from "express";
import z from "zod";
import { Role } from "../../lib/roles";
import { checkAuth } from "../../middleware/checkAuth";
import { optionalAuth } from "../../middleware/optionalAuth";
import { heavyOpsRateLimiter } from "../../middleware/rateLimiter";
import { validateRequest } from "../../middleware/validateRequest";
import { CertificateController } from "./certificate.controller";

const router = Router();

const ADMINS = [Role.ADMIN, Role.SUPER_ADMIN] as const;

const revokeZodSchema = z.object({
    reason: z.string().trim().min(3, "Give a reason for revoking this certificate").max(500),
});

const issueManuallyZodSchema = z.object({
    enrollmentId: z.string().trim().min(1, "Enrolment is required"),
    reason: z.string().trim().max(500).optional(),
});

// ---- Admin. Declared before "/verify/:certificateNo" is irrelevant (different
// prefix), but kept first for consistency with the other modules.
router.get("/manage", checkAuth(...ADMINS), CertificateController.getAllCertificates);
// The same list as a CSV download.
router.get("/manage/export", checkAuth(...ADMINS), heavyOpsRateLimiter, CertificateController.exportCertificates);

router.post(
    "/manage/issue",
    checkAuth(...ADMINS),
    validateRequest(issueManuallyZodSchema),
    CertificateController.issueManually,
);

router.patch(
    "/manage/:certificateId/revoke",
    checkAuth(...ADMINS),
    validateRequest(revokeZodSchema),
    CertificateController.revokeCertificate,
);

router.patch(
    "/manage/:certificateId/restore",
    checkAuth(...ADMINS),
    CertificateController.restoreCertificate,
);

// ---- Public verification (plan §29). No auth: the whole point is that
// anyone holding the number can check it. Rate-limited so the endpoint can't
// be used to enumerate valid certificate numbers.
router.get(
    "/verify/:certificateNo",
    heavyOpsRateLimiter,
    CertificateController.verifyCertificate,
);

// PDF download. Public for the same reason verification is: a certificate is
// meant to be handed to an employer. Rate-limited so the endpoint can't be used
// to enumerate numbers or burn CPU rendering PDFs in a loop.
router.get(
    "/download/:certificateNo",
    heavyOpsRateLimiter,
    optionalAuth,
    CertificateController.downloadCertificate,
);

// ---- Student. Certificates are earned by completing a course, so only a
// student has one to list, check eligibility for, or claim.
router.get("/my", checkAuth(Role.STUDENT), CertificateController.getMyCertificates);
router.get(
    "/eligibility/:courseId",
    checkAuth(Role.STUDENT),
    CertificateController.getMyEligibility,
);
router.post("/claim/:courseId", checkAuth(Role.STUDENT), CertificateController.claimCertificate);

export const CertificateRoutes = router;
