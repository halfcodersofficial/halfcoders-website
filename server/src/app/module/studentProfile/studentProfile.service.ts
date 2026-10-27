import status from "http-status";
import AppError from "../../errorHelpers/AppError";
import { IRequestUser } from "../../interfaces/requestUser.interface";
import { flattenLearner } from "../../lib/learningProfile";
import { prisma } from "../../lib/prisma";

/** A cleared text field arrives as `""`; store that as "unset", not as text. */
const nullifyEmptyStrings = <T extends Record<string, unknown>>(payload: T): T =>
    Object.fromEntries(
        Object.entries(payload).map(([key, value]) => [key, value === "" ? null : value]),
    ) as T;

// ── Additional Info ─────────────────────────────────────────────────────────

const getAdditionalInfo = (user: IRequestUser) =>
    prisma.studentAdditionalInfo.findUnique({ where: { userId: user.userId } });

const updateAdditionalInfo = (user: IRequestUser, payload: Record<string, unknown>) => {
    const data = nullifyEmptyStrings(payload);
    return prisma.studentAdditionalInfo.upsert({
        where: { userId: user.userId },
        create: { userId: user.userId, ...data },
        update: data,
    });
};

// ── Address ──────────────────────────────────────────────────────────────────

const getAddress = (user: IRequestUser) =>
    prisma.studentAddress.findUnique({ where: { userId: user.userId } });

/**
 * When `sameAsPresent` is set, the permanent-address fields are overwritten
 * from the present ones server-side — the client checkbox is a convenience,
 * this is the authoritative copy so the two blocks can never drift apart.
 */
const updateAddress = (user: IRequestUser, payload: Record<string, unknown>) => {
    const clean = nullifyEmptyStrings(payload);
    const data = clean.sameAsPresent
        ? {
              ...clean,
              permanentCountry: clean.presentCountry ?? null,
              permanentDistrict: clean.presentDistrict ?? null,
              permanentStreetAddress: clean.presentStreetAddress ?? null,
          }
        : clean;

    return prisma.studentAddress.upsert({
        where: { userId: user.userId },
        create: { userId: user.userId, ...data },
        update: data,
    });
};

// ── Education ────────────────────────────────────────────────────────────────

const getEducation = (user: IRequestUser) =>
    prisma.studentEducation.findUnique({ where: { userId: user.userId } });

const updateEducation = (user: IRequestUser, payload: Record<string, unknown>) => {
    const data = nullifyEmptyStrings(payload);
    return prisma.studentEducation.upsert({
        where: { userId: user.userId },
        create: { userId: user.userId, ...data },
        update: data,
    });
};

// ── Important Links (singleton fields — project cards are their own module) ──

const getLinks = (user: IRequestUser) =>
    prisma.studentLinks.findUnique({ where: { userId: user.userId } });

const updateLinks = (user: IRequestUser, payload: Record<string, unknown>) => {
    const data = nullifyEmptyStrings(payload);
    return prisma.studentLinks.upsert({
        where: { userId: user.userId },
        create: { userId: user.userId, ...data },
        update: data,
    });
};

// ── Job Profile ──────────────────────────────────────────────────────────────

const getJobProfile = (user: IRequestUser) =>
    prisma.studentJobProfile.findUnique({ where: { userId: user.userId } });

const updateJobProfile = (user: IRequestUser, payload: Record<string, unknown>) => {
    const data = nullifyEmptyStrings(payload);
    return prisma.studentJobProfile.upsert({
        where: { userId: user.userId },
        create: { userId: user.userId, ...data },
        update: data,
    });
};

// ── Overview (My Profile page + completion bar) ─────────────────────────────

/**
 * Equal-weight across 7 foundational sections. Job Experience, Got Hired,
 * Course Request, Order History, Certification and account
 * Settings are deliberately excluded — they're historical/log data or
 * legitimately-optional life circumstances that shouldn't cap a student below
 * 100% completion.
 */
const SCORED_SECTION_COUNT = 7;

type ScoredProfile = {
    profile: { name: string; phone: string | null; whatsapp?: string | null };
    additionalInfo: Awaited<ReturnType<typeof getAdditionalInfo>>;
    address: Awaited<ReturnType<typeof getAddress>>;
    education: Awaited<ReturnType<typeof getEducation>>;
    links: Awaited<ReturnType<typeof getLinks>>;
    jobProfile: Awaited<ReturnType<typeof getJobProfile>>;
    skillCount: number;
};

/**
 * Which of the seven scored sections are complete, and the percentage that
 * makes. Shared with the admin's student detail page, so the admin sees the
 * same completion the student does.
 */
export const scoreProfileSections = ({
    profile,
    additionalInfo,
    address,
    education,
    links,
    jobProfile,
    skillCount,
}: ScoredProfile) => {
    const sections = {
        myProfile: Boolean(profile.name && profile.phone && profile.whatsapp),
        additionalInfo: Boolean(
            additionalInfo?.gender &&
                additionalInfo.ageRange &&
                additionalInfo.primaryDeviceType &&
                additionalInfo.internetType &&
                additionalInfo.yearsOfExperience &&
                additionalInfo.employmentRole &&
                additionalInfo.areaType,
        ),
        address: Boolean(
            address?.presentCountry &&
                address.presentDistrict &&
                address.presentStreetAddress &&
                address.permanentCountry &&
                address.permanentDistrict &&
                address.permanentStreetAddress,
        ),
        education: Boolean(education?.level && education.examTitle && education.institutionName),
        importantLinks: Boolean(
            links &&
                [links.cvUrl, links.githubUrl, links.portfolioUrl, links.linkedinUrl, links.profileImageUrl].some(
                    Boolean,
                ),
        ),
        skillSet: skillCount > 0,
        jobProfile: Boolean(
            jobProfile &&
                jobProfile.wantsJob !== null &&
                jobProfile.jobType &&
                jobProfile.jobPreference &&
                jobProfile.wantsJobOutsideBangladesh !== null &&
                jobProfile.hasJobExperience !== null,
        ),
    };

    const completedCount = Object.values(sections).filter(Boolean).length;
    return { sections, completionPercent: Math.round((completedCount / SCORED_SECTION_COUNT) * 100) };
};

const getOverview = async (user: IRequestUser) => {
    const [
        profile,
        additionalInfo,
        address,
        education,
        links,
        jobProfile,
        projectCount,
        skillCount,
        jobExperienceCount,
        hiredRecordCount,
        courseRequestCount,
    ] = await Promise.all([
        // Name/email/phone/photo/role come from the account; WhatsApp and
        // student id from the learning profile.
        prisma.user.findUnique({
            where: { id: user.userId },
            select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                image: true,
                createdAt: true,
                role: true,
                learningProfile: { select: { whatsapp: true, studentId: true } },
            },
        }).then(async (record) =>
            record
                ? { ...flattenLearner(record), email: record.email }
                : null,
        ),
        prisma.studentAdditionalInfo.findUnique({ where: { userId: user.userId } }),
        prisma.studentAddress.findUnique({ where: { userId: user.userId } }),
        prisma.studentEducation.findUnique({ where: { userId: user.userId } }),
        prisma.studentLinks.findUnique({ where: { userId: user.userId } }),
        prisma.studentJobProfile.findUnique({ where: { userId: user.userId } }),
        prisma.studentProject.count({ where: { userId: user.userId } }),
        prisma.studentSkill.count({ where: { userId: user.userId } }),
        prisma.studentJobExperience.count({ where: { userId: user.userId } }),
        prisma.studentHiredRecord.count({ where: { userId: user.userId } }),
        prisma.studentCourseRequest.count({ where: { userId: user.userId } }),
    ]);

    if (!profile) throw new AppError(status.NOT_FOUND, "Account not found.");

    const { sections, completionPercent } = scoreProfileSections({
        profile,
        additionalInfo,
        address,
        education,
        links,
        jobProfile,
        skillCount,
    });

    return {
        profile,
        additionalInfo,
        address,
        education,
        links,
        jobProfile,
        counts: {
            projects: projectCount,
            skills: skillCount,
            jobExperiences: jobExperienceCount,
            hiredRecords: hiredRecordCount,
            courseRequests: courseRequestCount,
        },
        completionPercent,
        sections,
    };
};

export const StudentProfileService = {
    getOverview,
    getAdditionalInfo,
    updateAdditionalInfo,
    getAddress,
    updateAddress,
    getEducation,
    updateEducation,
    getLinks,
    updateLinks,
    getJobProfile,
    updateJobProfile,
};
