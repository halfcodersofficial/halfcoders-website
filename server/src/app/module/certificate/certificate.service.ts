import status from "http-status";
import { Prisma } from "../../../generated/prisma/client";
import {
    CertificateStatus,
    EnrollmentStatus,
    NotificationType,
    RewardCondition,
    SubmissionStatus,
} from "../../../generated/prisma/enums";
import { envVars } from "../../config/env";
import AppError from "../../errorHelpers/AppError";
import { IQueryParams } from "../../interfaces/query.interface";
import { IRequestUser } from "../../interfaces/requestUser.interface";
import { prisma } from "../../lib/prisma";
import { logger } from "../../utils/logger";
import { getCertificatePrefix } from "../../utils/platformSettings";
import { QueryBuilder } from "../../utils/QueryBuilder";
import { buildCertificatePdf } from "../../utils/certificatePdf";
import { grantCompletionReward, rewardMainCourse } from "../../utils/courseGrants";
import { nextCertificateNumber, withUniqueRetry } from "../../utils/referenceNumber";
import { createNotification } from "../notification/notification.service";
import { collectAll, toCsv } from "../../utils/csvExport";

export interface EligibilityReport {
    eligible: boolean;
    progress: number;
    requiredAssignments: number;
    acceptedAssignments: number;
    totalMilestones: number;
    completedMilestones: number;
    /** Human-readable reasons, empty when eligible. */
    blockers: string[];
}

/**
 * Certificate eligibility (plan §28): 100% course progress **and** every
 * published assignment accepted **and** every published milestone complete.
 *
 * Evaluated live rather than from a stored flag, so publishing new content
 * into a finished course immediately withdraws eligibility instead of leaving
 * a stale "eligible" bit behind.
 */
const checkEligibility = async (enrollmentId: string): Promise<EligibilityReport> => {
    const enrollment = await prisma.enrollment.findUnique({
        where: { id: enrollmentId },
        select: {
            id: true, studentId: true, courseId: true, progress: true, status: true,
            course: { select: { milestoneLabel: true } },
        },
    });
    if (!enrollment) throw new AppError(status.NOT_FOUND, "Enrolment not found.");

    const [rewardWith, requiredAssignments, acceptedAssignments, totalMilestones, completedMilestones] =
        await Promise.all([
            rewardMainCourse(enrollment.studentId, enrollment.courseId),
            prisma.assignment.count({
                where: { courseId: enrollment.courseId, isPublished: true },
            }),
            prisma.assignmentSubmission.count({
                where: {
                    enrollmentId,
                    status: SubmissionStatus.ACCEPTED,
                    assignment: { isPublished: true },
                },
            }),
            // Only milestones that actually hold published modules count. A
            // published-but-empty milestone is unfinished *authoring*, not
            // unfinished learning — counting it would permanently block every
            // student on the course behind content that doesn't exist.
            prisma.milestone.count({
                where: {
                    courseId: enrollment.courseId,
                    isPublished: true,
                    modules: { some: { isPublished: true } },
                },
            }),
            prisma.milestoneProgress.count({
                where: { enrollmentId, isCompleted: true },
            }),
        ]);

    const blockers: string[] = [];

    // A reward course rides on its main course, and so does the certificate.
    if (rewardWith) {
        blockers.push(`This is a reward course with "${rewardWith.title}" — it has no certificate of its own. Your certificate is for "${rewardWith.title}".`);
    }
    if (enrollment.status === EnrollmentStatus.CANCELLED) {
        blockers.push("Your enrolment in this course was cancelled.");
    }
    if (enrollment.progress < 100) {
        blockers.push(`Course progress is ${enrollment.progress}% — finish every video first.`);
    }
    if (acceptedAssignments < requiredAssignments) {
        blockers.push(
            `${acceptedAssignments} of ${requiredAssignments} assignment(s) accepted — all must be accepted.`,
        );
    }
    if (completedMilestones < totalMilestones) {
        const label = enrollment.course.milestoneLabel.toLowerCase();
        blockers.push(`${completedMilestones} of ${totalMilestones} ${label}(s) complete.`);
    }

    return {
        eligible: blockers.length === 0,
        progress: enrollment.progress,
        requiredAssignments,
        acceptedAssignments,
        totalMilestones,
        completedMilestones,
        blockers,
    };
};

const certificateInclude = {
    course: { select: { id: true, title: true, slug: true, thumbnail: true } },
    student: { select: { id: true, name: true, image: true } },
} as const;

const verificationUrl = (certificateNo: string) =>
    `${envVars.FRONTEND_URL}/certificate/${certificateNo}`;

/**
 * What a new certificate prints besides the names (layout 2): the course's
 * duration as it reads today, and "Passed" rather than "Completed" when the
 * course had graded work — a published assignment or quiz.
 */
const issueSnapshot = async (courseId: string, duration: string | null) => {
    const [assignments, quizzes] = await Promise.all([
        prisma.assignment.count({ where: { courseId, isPublished: true } }),
        prisma.quiz.count({ where: { courseId, isPublished: true } }),
    ]);
    return { layout: 2, trainingDuration: duration, assessed: assignments + quizzes > 0 };
};

/**
 * Issues the certificate for a completed enrolment (plan §28).
 *
 * The student's name and the course title are snapshotted onto the row: a
 * later profile rename or course re-title must never contradict a certificate
 * that has already been printed and shared.
 */
const claimCertificate = async (user: IRequestUser, courseId: string) => {
    const enrollment = await prisma.enrollment.findUnique({
        where: { studentId_courseId: { studentId: user.userId, courseId } },
        select: {
            id: true,
            studentId: true,
            completedAt: true,
            certificate: { select: { id: true } },
            student: { select: { name: true, email: true } },
            course: { select: { title: true, slug: true, duration: true, certificateCode: true } },
        },
    });
    if (!enrollment) throw new AppError(status.NOT_FOUND, "You are not enrolled in this course.");

    // Already issued — hand back the existing one rather than minting a second
    // number for the same achievement.
    if (enrollment.certificate) {
        return prisma.certificate.findUniqueOrThrow({
            where: { id: enrollment.certificate.id },
            include: certificateInclude,
        });
    }

    const eligibility = await checkEligibility(enrollment.id);
    if (!eligibility.eligible) {
        throw new AppError(
            status.BAD_REQUEST,
            "You're not eligible for this certificate yet.",
        ).setData(eligibility);
    }

    const prefix = await getCertificatePrefix();
    const snapshot = await issueSnapshot(courseId, enrollment.course.duration);
    logger.create("Issuing certificate", { enrollmentId: enrollment.id });

    const certificate = await withUniqueRetry(async () => {
        const certificateNo = await nextCertificateNumber(prefix, enrollment.course.certificateCode);
        return prisma.certificate.create({
            data: {
                certificateNo,
                studentId: enrollment.studentId,
                courseId,
                enrollmentId: enrollment.id,
                studentName: enrollment.student.name,
                courseName: enrollment.course.title,
                ...snapshot,
                completionDate: enrollment.completedAt ?? new Date(),
            },
            include: certificateInclude,
        });
    });

    await createNotification({
        userId: enrollment.studentId,
        title: "Your certificate is ready 🎓",
        message: `Congratulations on completing ${enrollment.course.title}. Certificate ${certificate.certificateNo} is available in your profile.`,
        type: NotificationType.CERTIFICATE,
        link: `/certificate/${certificate.certificateNo}`,
        email: { actionLabel: "View your certificate" },
    });
    await grantCompletionReward(enrollment.id, RewardCondition.CERTIFICATE, certificate.issuedAt);

    return { ...certificate, verificationUrl: verificationUrl(certificate.certificateNo) };
};

/** Eligibility panel on the course page — why the button is or isn't active. */
const getMyEligibility = async (user: IRequestUser, courseId: string) => {
    const enrollment = await prisma.enrollment.findUnique({
        where: { studentId_courseId: { studentId: user.userId, courseId } },
        select: { id: true, certificate: { select: { id: true, certificateNo: true, issuedAt: true } } },
    });
    if (!enrollment) throw new AppError(status.NOT_FOUND, "You are not enrolled in this course.");

    const eligibility = await checkEligibility(enrollment.id);

    return {
        ...eligibility,
        certificate: enrollment.certificate,
        alreadyIssued: Boolean(enrollment.certificate),
    };
};

/** "My Certificates" on the profile page (plan §30). */
const getMyCertificates = async (user: IRequestUser, query: IQueryParams) => {
    const result = await new QueryBuilder(prisma.certificate, query, {
        filterableFields: ["status", "courseId"],
        // Certificates timestamp with `issuedAt`; they have no `createdAt`.
        defaultSortBy: "issuedAt",
        sortableFields: ["issuedAt", "completionDate", "certificateNo", "status"],
        maxLimit: 50,
    })
        .filter()
        .sort()
        .paginate()
        .include(certificateInclude)
        .where({ studentId: user.userId })
        .execute();

    return {
        ...result,
        data: result.data.map((certificate) => ({
            ...(certificate as Record<string, unknown>),
            verificationUrl: verificationUrl((certificate as { certificateNo: string }).certificateNo),
        })),
    };
};

/**
 * Public verification (plan §29). No authentication: anyone holding a
 * certificate number can confirm it.
 *
 * Deliberately narrow — it returns only what a verifier needs to see (name,
 * course, dates, validity) and nothing else about the student. A revoked
 * certificate resolves and reports as revoked rather than 404ing, so a
 * verifier learns the truth instead of "not found".
 */
const verifyCertificate = async (certificateNo: string) => {
    const certificate = await prisma.certificate.findUnique({
        where: { certificateNo: certificateNo.trim().toUpperCase() },
        select: {
            certificateNo: true,
            studentName: true,
            courseName: true,
            completionDate: true,
            issuedAt: true,
            status: true,
            revokedAt: true,
            course: { select: { title: true, slug: true, thumbnail: true } },
        },
    });

    if (!certificate) {
        throw new AppError(
            status.NOT_FOUND,
            "No certificate found with that ID. Check the number and try again.",
        );
    }

    return {
        valid: certificate.status === CertificateStatus.ISSUED,
        certificateNo: certificate.certificateNo,
        studentName: certificate.studentName,
        courseName: certificate.courseName,
        completionDate: certificate.completionDate,
        issuedAt: certificate.issuedAt,
        status: certificate.status,
        revokedAt: certificate.revokedAt,
        issuer: "Half Coders",
    };
};

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

const getAllCertificates = async (query: IQueryParams) => {
    return new QueryBuilder(prisma.certificate, query, {
        searchableFields: ["certificateNo", "studentName", "courseName"],
        filterableFields: ["status", "courseId", "studentId"],
        defaultSortBy: "issuedAt",
        sortableFields: ["issuedAt", "completionDate", "certificateNo", "status"],
        maxLimit: 100,
    })
        .search()
        .filter()
        .sort()
        .paginate()
        .include({
            ...certificateInclude,
            student: { select: { id: true, name: true, email: true, image: true } },
        })
        .execute();
};

/** The certificates list as a CSV — same filters, search and order as on screen. */
const exportCertificates = async (query: IQueryParams) => {
    const certificates = (await collectAll(getAllCertificates, query)) as Prisma.CertificateGetPayload<{
        include: { student: { select: { email: true } } };
    }>[];
    return toCsv(
        ["Certificate", "Student", "Email", "Course", "Status", "Completed", "Issued", "Revoked", "Why revoked", "Verify at"],
        certificates.map((certificate) => [
            certificate.certificateNo,
            certificate.studentName,
            certificate.student.email,
            certificate.courseName,
            certificate.status,
            certificate.completionDate,
            certificate.issuedAt,
            certificate.revokedAt,
            certificate.revokeReason,
            verificationUrl(certificate.certificateNo),
        ]),
    );
};

/**
 * Admin override for a certificate issued in error, or one that has to be
 * withdrawn. Revocation is reversible and never deletes the row — the number
 * stays resolvable so anyone who already has it learns it is no longer valid.
 */
const revokeCertificate = async (certificateId: string, reason: string) => {
    const certificate = await prisma.certificate.findUnique({
        where: { id: certificateId },
        select: { id: true, status: true, studentId: true, courseName: true, certificateNo: true },
    });
    if (!certificate) throw new AppError(status.NOT_FOUND, "Certificate not found.");
    if (certificate.status === CertificateStatus.REVOKED) {
        throw new AppError(status.BAD_REQUEST, "This certificate is already revoked.");
    }

    logger.update("Revoking certificate", { certificateId, reason });

    const revoked = await prisma.certificate.update({
        where: { id: certificateId },
        data: {
            status: CertificateStatus.REVOKED,
            revokedAt: new Date(),
            revokeReason: reason,
        },
        include: certificateInclude,
    });

    await createNotification({
        userId: certificate.studentId,
        title: "Certificate revoked",
        message: `Your certificate for ${certificate.courseName} (${certificate.certificateNo}) has been revoked. Reason: ${reason}`,
        type: NotificationType.CERTIFICATE,
        email: { actionLabel: "Open Half Coders" },
    });

    return revoked;
};

const restoreCertificate = async (certificateId: string) => {
    const certificate = await prisma.certificate.findUnique({
        where: { id: certificateId },
        select: { id: true, status: true },
    });
    if (!certificate) throw new AppError(status.NOT_FOUND, "Certificate not found.");

    return prisma.certificate.update({
        where: { id: certificateId },
        data: { status: CertificateStatus.ISSUED, revokedAt: null, revokeReason: null },
        include: certificateInclude,
    });
};

/**
 * Admin issue-on-behalf, for a student who earned a certificate through a
 * route the automatic check can't see (an offline assessment, a migrated
 * cohort). Skips the eligibility gate by design — that is the point of the
 * override — and is logged as such.
 */
const issueManually = async (
    actor: IRequestUser,
    input: { enrollmentId: string; reason?: string },
) => {
    const enrollment = await prisma.enrollment.findUnique({
        where: { id: input.enrollmentId },
        select: {
            id: true,
            studentId: true,
            courseId: true,
            completedAt: true,
            certificate: { select: { id: true } },
            student: { select: { name: true } },
            course: { select: { title: true, duration: true, certificateCode: true } },
        },
    });
    if (!enrollment) throw new AppError(status.NOT_FOUND, "Enrolment not found.");
    if (enrollment.certificate) {
        throw new AppError(status.CONFLICT, "This enrolment already has a certificate.");
    }
    // Not even by hand: the certificate is the main course's.
    const rewardWith = await rewardMainCourse(enrollment.studentId, enrollment.courseId);
    if (rewardWith) {
        throw new AppError(
            status.BAD_REQUEST,
            `${enrollment.student.name} has "${enrollment.course.title}" as a reward course with "${rewardWith.title}", so it has no certificate of its own. Issue the certificate for "${rewardWith.title}" instead.`,
        );
    }

    const prefix = await getCertificatePrefix();
    const snapshot = await issueSnapshot(enrollment.courseId, enrollment.course.duration);
    logger.create("Manually issuing certificate", {
        enrollmentId: enrollment.id,
        by: actor.userId,
        reason: input.reason,
    });

    const certificate = await withUniqueRetry(async () => {
        const certificateNo = await nextCertificateNumber(prefix, enrollment.course.certificateCode);
        return prisma.certificate.create({
            data: {
                certificateNo,
                studentId: enrollment.studentId,
                courseId: enrollment.courseId,
                enrollmentId: enrollment.id,
                studentName: enrollment.student.name,
                courseName: enrollment.course.title,
                ...snapshot,
                completionDate: enrollment.completedAt ?? new Date(),
            },
            include: certificateInclude,
        });
    });

    await createNotification({
        userId: enrollment.studentId,
        title: "Your certificate is ready 🎓",
        message: `Certificate ${certificate.certificateNo} for ${enrollment.course.title} has been issued.`,
        type: NotificationType.CERTIFICATE,
        link: `/certificate/${certificate.certificateNo}`,
        senderId: actor.userId,
        email: { actionLabel: "View your certificate" },
    });
    await grantCompletionReward(enrollment.id, RewardCondition.CERTIFICATE, certificate.issuedAt);

    return certificate;
};

/**
 * Renders the certificate PDF (plan §5.1 — students view *and* download).
 *
 * The owner can always download their own; anyone else may download by number,
 * because a certificate is meant to be shown to employers and the verification
 * page is already public. A revoked one is refused outright rather than handing
 * out a document that looks valid.
 */
const downloadCertificate = async (certificateNo: string, user?: IRequestUser) => {
    const certificate = await prisma.certificate.findUnique({
        where: { certificateNo: certificateNo.trim().toUpperCase() },
        include: { course: { select: { milestoneLabel: true, moduleLabel: true } } },
    });

    if (!certificate) throw new AppError(status.NOT_FOUND, "Certificate not found.");

    if (certificate.status === CertificateStatus.REVOKED) {
        throw new AppError(
            status.GONE,
            "This certificate has been revoked and can no longer be downloaded.",
        );
    }

    logger.read("Certificate downloaded", {
        certificateNo: certificate.certificateNo,
        by: user?.userId ?? "anonymous",
    });

    const pdf = await buildCertificatePdf({
        certificateNo: certificate.certificateNo,
        studentName: certificate.studentName,
        courseName: certificate.courseName,
        completionDate: certificate.completionDate,
        issuedAt: certificate.issuedAt,
        milestoneLabel: certificate.course.milestoneLabel,
        moduleLabel: certificate.course.moduleLabel,
        layout: certificate.layout,
        trainingDuration: certificate.trainingDuration,
        assessed: certificate.assessed,
    });

    return { pdf, certificateNo: certificate.certificateNo };
};

export const CertificateService = {
    exportCertificates,
    checkEligibility,
    downloadCertificate,
    claimCertificate,
    getMyEligibility,
    getMyCertificates,
    verifyCertificate,
    getAllCertificates,
    revokeCertificate,
    restoreCertificate,
    issueManually,
};
