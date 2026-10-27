import { Router } from "express";
import status from "http-status";
import { CertificateStatus, CourseStatus } from "../../../generated/prisma/enums";
import { Role } from "../../lib/roles";
import { activeLearnerScope } from "../../lib/learningProfile";
import { prisma } from "../../lib/prisma";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";

const router = Router();

/**
 * Public counters for the homepage statistics strip (plan §7).
 *
 * Deliberately just four totals and nothing identifying — this endpoint is
 * unauthenticated, so it must never become a way to enumerate who is on the
 * platform. Blocked and deleted accounts are excluded so the numbers describe
 * the live community rather than every row ever written.
 */
const publicStats = catchAsync(async (_req, res) => {
    const [students, courses, mentors, certificates] = await Promise.all([
        prisma.user.count({ where: activeLearnerScope(Role.STUDENT) }),
        prisma.course.count({ where: { status: CourseStatus.PUBLISHED, isDeleted: false } }),
        prisma.user.count({ where: activeLearnerScope(Role.MENTOR) }),
        prisma.certificate.count({ where: { status: CertificateStatus.ISSUED } }),
    ]);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Statistics fetched successfully",
        data: { students, courses, mentors, certificates },
    });
});

router.get("/public", publicStats);

export const StatsRoutes = router;
