import status from "http-status";
import { Prisma } from "../../../generated/prisma/client";
import { AccountStatus, EnrollmentStatus, LearningStatus } from "../../../generated/prisma/enums";
import {
    deleteFileFromCloudinary,
    isOwnCloudinaryAsset,
    uploadFileToCloudinary,
} from "../../config/cloudinary.config";
import AppError from "../../errorHelpers/AppError";
import { IQueryParams } from "../../interfaces/query.interface";
import { IRequestUser } from "../../interfaces/requestUser.interface";
import {
    ensureLearningProfile,
    flattenLearner,
    learnerIdentitySelect,
    learnerScope,
    toLearnerQuery,
} from "../../lib/learningProfile";
import { hashPassword } from "../../lib/password";
import { prisma } from "../../lib/prisma";
import { Role } from "../../lib/roles";
import { logger } from "../../utils/logger";
import { assertRealEmail } from "../../utils/realEmail";
import { sendPasswordResetFor } from "../auth/auth.service";
import { QueryBuilder } from "../../utils/QueryBuilder";
import { lastLearningActivity } from "./studentDetail.service";
import { collectAll, toCsv } from "../../utils/csvExport";

/**
 * Half Coders' people management (plan §36 → Users): the student and mentor
 * registers, making mentors and admins, roles, and learning-only moderation
 * (`LearningProfile.status`). Passwords are never seen or set by an admin —
 * a reset mails the person a code (`sendPasswordResetFor`); a new staff
 * account starts on a temporary password they must change at first sign-in.
 */

const learningListSelect = { status: true, studentId: true, createdAt: true } as const;

type Learner = Parameters<typeof flattenLearner>[0];

type StudentRow = Learner & { id: string; courseXp: { totalXp: number }[] };

/** Where the register's sort control may point — anything else falls back to newest. */
const STUDENT_SORTS = ["learningProfile.createdAt", "name"];

/**
 * Admin student register (plan §36 → Users). Each row carries the courses
 * they're on with their progress, their XP and when they last did anything,
 * so the register can show how a student is doing without opening them.
 * `?courseId=` narrows it to one course's students.
 */
const getStudents = async (query: IQueryParams) => {
    const { courseId, ...rest } = query;
    const scope = learnerScope(Role.STUDENT);
    const where =
        typeof courseId === "string" && courseId
            ? { AND: [scope, { enrollments: { some: { courseId } } }] }
            : scope;

    const result = await new QueryBuilder(prisma.user, toLearnerQuery(rest) as IQueryParams, {
        searchableFields: ["name", "email", "phone", "learningProfile.studentId"],
        filterableFields: ["learningProfile.status", "emailVerified"],
        sortableFields: STUDENT_SORTS,
        // Newest to Half Coders first — matches the "joined" date shown.
        defaultSortBy: "learningProfile.createdAt",
        maxLimit: 100,
    })
        .search()
        .filter()
        .sort()
        .paginate()
        .include({
            learningProfile: { select: { ...learningListSelect, whatsapp: true } },
            enrollments: {
                where: { status: { not: EnrollmentStatus.CANCELLED } },
                orderBy: { updatedAt: "desc" },
                select: {
                    id: true,
                    status: true,
                    progress: true,
                    course: { select: { id: true, title: true, thumbnail: true } },
                },
            },
            courseXp: { select: { totalXp: true } },
            _count: { select: { enrollments: true, certificates: true, submissions: true } },
        })
        .where(where)
        .execute();

    const rows = result.data as StudentRow[];
    const lastActive = await lastLearningActivity(rows.map((row) => row.id));

    return {
        ...result,
        data: rows.map(({ courseXp, ...row }) => ({
            ...flattenLearner(row),
            totalXp: courseXp.reduce((sum, entry) => sum + entry.totalXp, 0),
            lastActiveAt: lastActive.get(row.id) ?? null,
        })),
    };
};

/** What a register row carries that the CSV uses (`getStudents` flattens the profile onto the user). */
type StudentExportRow = {
    studentId?: string | null;
    name: string;
    email: string | null;
    phone: string | null;
    whatsapp?: string | null;
    status: string;
    emailVerified: boolean;
    createdAt?: Date;
    totalXp: number;
    lastActiveAt: Date | null;
    enrollments: { progress: number; course: { title: string } }[];
    _count: { certificates: number; submissions: number };
};

/** The student register as a CSV — same filters, search and order as on screen. */
const exportStudents = async (query: IQueryParams) => {
    const students = (await collectAll(getStudents, query)) as unknown as StudentExportRow[];
    return toCsv(
        ["Student ID", "Name", "Email", "Phone", "WhatsApp", "Status", "Email verified", "Joined Half Coders", "Courses", "Certificates", "Hand-ins", "XP", "Last active"],
        students.map((student) => [
            student.studentId,
            student.name,
            student.email,
            student.phone,
            student.whatsapp,
            student.status,
            student.emailVerified ? "Yes" : "No",
            student.createdAt,
            student.enrollments.map((entry) => `${entry.course.title} (${entry.progress}%)`).join("; "),
            student._count.certificates,
            student._count.submissions,
            student.totalXp,
            student.lastActiveAt,
        ]),
    );
};

/** How many students each register filter holds — the counts beside the filter tabs. */
const getStudentCounts = async () => {
    const scope = learnerScope(Role.STUDENT);
    const count = (extra?: Prisma.UserWhereInput) =>
        prisma.user.count({ where: extra ? { AND: [scope, extra] } : scope });

    const [all, active, blocked, unverified] = await Promise.all([
        count(),
        count({ learningProfile: { status: LearningStatus.ACTIVE } }),
        count({ learningProfile: { status: LearningStatus.BLOCKED } }),
        count({ emailVerified: false }),
    ]);

    return { all, active, blocked, unverified };
};

const getStudentById = async (userId: string) => {
    const student = await prisma.user.findFirst({
        where: { id: userId, ...learnerScope(Role.STUDENT) },
        select: {
            ...learnerIdentitySelect,
            learningProfile: { select: { ...learningListSelect, bio: true, address: true, whatsapp: true } },
            enrollments: {
                include: {
                    course: { select: { id: true, title: true, slug: true, thumbnail: true } },
                    certificate: { select: { id: true, certificateNo: true, issuedAt: true } },
                },
                orderBy: { createdAt: "desc" },
            },
            orders: {
                select: { id: true, orderNumber: true, total: true, status: true, createdAt: true },
                orderBy: { createdAt: "desc" },
                take: 20,
            },
            courseXp: {
                select: { totalXp: true, course: { select: { id: true, title: true } } },
            },
        },
    });

    if (!student) throw new AppError(status.NOT_FOUND, "Student not found.");
    return flattenLearner(student);
};

/** Mentor directory for the admin console and the public "Mentors" section. */
const getMentors = async (query: IQueryParams) => {
    const result = await new QueryBuilder(prisma.user, toLearnerQuery(query) as IQueryParams, {
        searchableFields: ["name", "email", "mentorProfile.designation"],
        filterableFields: ["learningProfile.status"],
        // Newest to Half Coders first — matches the "joined" date shown.
        defaultSortBy: "learningProfile.createdAt",
        maxLimit: 100,
    })
        .search()
        .filter()
        .sort()
        .paginate()
        .include({
            learningProfile: { select: { ...learningListSelect, bio: true } },
            mentorProfile: true,
            _count: { select: { mentoredCourses: true } },
        })
        .where(learnerScope(Role.MENTOR))
        .execute();

    return { ...result, data: (result.data as Learner[]).map((row) => flattenLearner(row)) };
};

const getMentorById = async (mentorId: string) => {
    const mentor = await prisma.user.findFirst({
        where: { id: mentorId, ...learnerScope(Role.MENTOR) },
        select: {
            ...learnerIdentitySelect,
            learningProfile: { select: { ...learningListSelect, bio: true } },
            mentorProfile: true,
            mentoredCourses: {
                select: {
                    role: true,
                    course: {
                        select: {
                            id: true, title: true, slug: true, thumbnail: true, status: true,
                            _count: { select: { enrollments: true } },
                        },
                    },
                },
            },
        },
    });

    if (!mentor) throw new AppError(status.NOT_FOUND, "Mentor not found.");
    return flattenLearner(mentor);
};

type MentorPayload = {
    name: string;
    email: string;
    password: string;
    phone?: string;
    image?: string;
    bio?: string;
    designation?: string;
    expertise?: string[];
    experience?: string;
    facebookUrl?: string;
    linkedinUrl?: string;
    githubUrl?: string;
    websiteUrl?: string;
    isFeatured?: boolean;
};

/**
 * A new staff account (mentor or admin): verified by the admin who makes it,
 * on the temporary password they chose, which must be changed at first
 * sign-in.
 */
const createStaffAccount = async (
    role: Role,
    input: { name: string; email: string; password: string; phone?: string; image?: string },
) => {
    const email = input.email.trim().toLowerCase();
    await assertRealEmail(email);
    if (input.phone) {
        const phoneOwner = await prisma.user.findUnique({ where: { phone: input.phone }, select: { id: true } });
        if (phoneOwner) throw new AppError(status.CONFLICT, "This mobile number is already used by another account.");
    }
    const user = await prisma.user.create({
        data: {
            name: input.name,
            email,
            phone: input.phone || null,
            image: input.image || null,
            role,
            emailVerified: true,
            needPasswordChange: true,
            passwordHash: await hashPassword(input.password),
            learningProfile: { create: {} },
        },
        select: { id: true },
    });
    return user.id;
};

/**
 * Finds or creates the MENTOR account for `input.email`.
 *
 * - No account: a new MENTOR account on the admin's temporary password, to be
 *   replaced at first sign-in.
 * - An existing student: made a mentor, keeping their own password.
 * - Anyone else (a mentor already, an admin, a deleted or blocked account):
 *   refused.
 */
const resolveMentorAccount = async (
    input: { name: string; email: string; password: string; phone?: string; image?: string },
): Promise<{ userId: string; linkedExistingAccount: boolean }> => {
    const existing = await prisma.user.findFirst({
        where: { email: { equals: input.email.trim(), mode: "insensitive" } },
        select: { id: true, role: true, status: true, isDeleted: true },
    });

    if (!existing) return { userId: await createStaffAccount(Role.MENTOR, input), linkedExistingAccount: false };

    if (existing.isDeleted || existing.status !== AccountStatus.ACTIVE) {
        throw new AppError(status.CONFLICT, "That account is not active and can't be made a mentor.");
    }
    if (existing.role === Role.MENTOR) {
        throw new AppError(status.CONFLICT, "This account is already a Half Coders mentor.");
    }
    if (existing.role !== Role.STUDENT) {
        throw new AppError(status.CONFLICT, "This email belongs to an administrator account, which can't be a mentor. Use a different email.");
    }

    await prisma.user.update({ where: { id: existing.id }, data: { role: Role.MENTOR } });
    return { userId: existing.id, linkedExistingAccount: true };
};

/**
 * Makes someone a Half Coders mentor (plan §20) — see `resolveMentorAccount` for
 * how the account is found or created.
 */
const createMentor = async (actor: IRequestUser, payload: MentorPayload) => {
    const { name, email, password, phone, image, bio, ...profile } = payload;

    logger.create("Granting mentor role", { email, actorId: actor.userId });

    const { userId, linkedExistingAccount } = await resolveMentorAccount({ name, email, password, phone, image });

    await prisma.learningProfile.upsert({
        where: { userId },
        create: { userId, bio },
        update: { status: LearningStatus.ACTIVE, deletedAt: null, ...(bio !== undefined ? { bio } : {}) },
    });
    await prisma.mentorProfile.upsert({
        where: { userId },
        create: { userId, ...profile },
        update: profile,
    });

    const mentor = await getMentorById(userId);
    return { ...mentor, linkedExistingAccount };
};

const updateMentor = async (_actor: IRequestUser, mentorId: string, payload: Record<string, unknown>) => {
    const mentor = await prisma.user.findFirst({
        where: { id: mentorId, ...learnerScope(Role.MENTOR) },
        select: { id: true },
    });
    if (!mentor) throw new AppError(status.NOT_FOUND, "Mentor not found.");

    const { name, image, bio, ...profile } = payload;

    // The mentor's name and photo, on their account.
    if (name !== undefined || image !== undefined) {
        await prisma.user.update({
            where: { id: mentorId },
            data: {
                ...(name !== undefined ? { name: name as string } : {}),
                ...(image !== undefined ? { image: image as string | null } : {}),
            },
        });
    }

    if (bio !== undefined) {
        await prisma.learningProfile.update({ where: { userId: mentorId }, data: { bio: bio as string } });
    }

    if (Object.keys(profile).length > 0) {
        // The profile row may not exist yet for a mentor promoted from
        // another role, so upsert rather than update.
        await prisma.mentorProfile.upsert({
            where: { userId: mentorId },
            create: { userId: mentorId, ...profile },
            update: profile,
        });
    }

    return getMentorById(mentorId);
};

/**
 * Sets a mentor's shared profile photo from an uploaded image: their own
 * photo, or one of the default avatars. Every upload is the mentor's own
 * asset — never shared between mentors — so replacing it can delete it.
 */
const updateMentorPhoto = async (
    actor: IRequestUser,
    mentorId: string,
    file: { buffer: Buffer; originalname: string; mimetype: string },
) => {
    const mentor = await prisma.user.findFirst({
        where: { id: mentorId, ...learnerScope(Role.MENTOR) },
        select: { id: true, image: true },
    });
    if (!mentor) throw new AppError(status.NOT_FOUND, "Mentor not found.");

    // The shared upload middleware also lets PDFs through.
    if (!file.mimetype.startsWith("image/")) {
        throw new AppError(status.BAD_REQUEST, "Upload a JPEG, PNG or WebP image.");
    }

    logger.update("Updating mentor photo", { mentorId, actorId: actor.userId });

    const { secure_url: url } = await uploadFileToCloudinary(file.buffer, file.originalname);
    try {
        await prisma.user.update({ where: { id: mentorId }, data: { image: url } });
    } catch (error) {
        // Not saved — nothing points at the new upload.
        void deleteFileFromCloudinary(url);
        throw error;
    }

    // Only clean up a photo Half Coders uploaded.
    if (mentor.image && mentor.image !== url && isOwnCloudinaryAsset(mentor.image)) {
        void deleteFileFromCloudinary(mentor.image);
    }

    return getMentorById(mentorId);
};

/** Public mentor list for the marketing site's "Mentors" section (plan §7). */
const getPublicMentors = async () => {
    const mentors = await prisma.user.findMany({
        where: {
            ...learnerScope(Role.MENTOR),
            status: AccountStatus.ACTIVE,
            learningProfile: { status: LearningStatus.ACTIVE },
        },
        orderBy: [{ mentorProfile: { isFeatured: "desc" } }, { name: "asc" }],
        select: {
            id: true,
            name: true,
            image: true,
            learningProfile: { select: { bio: true } },
            mentorProfile: {
                select: {
                    designation: true, expertise: true, experience: true,
                    linkedinUrl: true, githubUrl: true, websiteUrl: true, isFeatured: true,
                },
            },
            mentoredCourses: {
                select: { course: { select: { id: true, title: true, slug: true } } },
                take: 5,
            },
        },
    });

    // Public payload: only the mentor's bio from the learning profile, not
    // their role/status.
    return mentors.map(({ learningProfile, ...mentor }) => ({ ...mentor, bio: learningProfile?.bio ?? null }));
};

/**
 * Loads the target and enforces the admin hierarchy shared by every
 * moderation action: nobody acts on themselves, nobody acts on a super admin
 * through the API, and only a super admin acts on an admin.
 */
const loadModerationTarget = async (actor: IRequestUser, userId: string, action: string) => {
    if (actor.userId === userId) {
        throw new AppError(status.BAD_REQUEST, `You cannot ${action} your own account.`);
    }
    // An admin is moderated whether or not they've opened Half Coders yet (the
    // admin directory lists them all); everyone else only once they have.
    const target = await prisma.user.findFirst({
        where: { id: userId, ...learnerScope(undefined, { requireMembership: false }) },
        select: { id: true, role: true, learningProfile: { select: { status: true } } },
    });
    if (!target) throw new AppError(status.NOT_FOUND, "User not found.");

    const role = target.role;
    if (role === Role.SUPER_ADMIN) {
        throw new AppError(status.FORBIDDEN, "Super admin accounts cannot be modified here.");
    }
    if (role === Role.ADMIN && actor.role !== Role.SUPER_ADMIN) {
        throw new AppError(status.FORBIDDEN, `Only a super admin can ${action} another admin.`);
    }
    if (!target.learningProfile && role !== Role.ADMIN) throw new AppError(status.NOT_FOUND, "User not found.");

    return { userId: target.id, role };
};

const moderatedUserSelect = {
    ...learnerIdentitySelect,
    learningProfile: { select: learningListSelect },
} as const;

/**
 * Learning-only moderation. Blocking or removing someone here revokes their
 * access immediately (checked on every request) without deleting the account.
 */
const changeUserStatus = async (actor: IRequestUser, userId: string, nextStatus: LearningStatus) => {
    await loadModerationTarget(actor, userId, "change the status of");

    logger.update("Changing learning status", { userId, status: nextStatus, actorId: actor.userId });

    // An admin who hasn't opened Half Coders yet gets the profile their access is checked against.
    await ensureLearningProfile(userId);
    await prisma.learningProfile.update({
        where: { userId },
        data: {
            status: nextStatus,
            deletedAt: nextStatus === LearningStatus.DELETED ? new Date() : null,
        },
    });

    const updated = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: moderatedUserSelect });
    return flattenLearner(updated);
};

/**
 * Makes a student a mentor or a mentor a student. Admins are made with
 * `createAdmin`, by a super admin.
 */
const changeUserRole = async (actor: IRequestUser, userId: string, nextRole: Role) => {
    const target = await loadModerationTarget(actor, userId, "change the role of");

    if (nextRole !== Role.STUDENT && nextRole !== Role.MENTOR) {
        throw new AppError(status.BAD_REQUEST, "Admins are added from the Admins page by a super admin.");
    }
    if (target.role !== Role.STUDENT && target.role !== Role.MENTOR) {
        throw new AppError(status.FORBIDDEN, "An administrator's role can't be changed here.");
    }

    logger.update("Changing role", { userId, role: nextRole, actorId: actor.userId });

    await prisma.user.update({ where: { id: userId }, data: { role: nextRole } });

    // Promoting to MENTOR needs the profile row the mentor endpoints and
    // course pages read from.
    if (nextRole === Role.MENTOR) {
        await prisma.mentorProfile.upsert({ where: { userId }, create: { userId }, update: {} });
    }

    const updated = await prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { ...moderatedUserSelect, mentorProfile: true },
    });
    return flattenLearner(updated);
};

/**
 * Admin-initiated credential recovery: the person is mailed a reset code and
 * chooses the new password themselves. The admin never sees or sets it.
 */
const resetUserPassword = async (actor: IRequestUser, userId: string) => {
    if (actor.userId === userId) {
        throw new AppError(
            status.BAD_REQUEST,
            "You cannot reset your own password here — change it from your account settings.",
        );
    }

    await loadModerationTarget(actor, userId, "reset the password of");

    const account = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { id: true, email: true } });
    await sendPasswordResetFor(account);
    logger.update("Admin sent a password reset code", { targetUserId: userId, actorId: actor.userId });
    return { userId, sentTo: account.email };
};

/** A super admin adding an administrator, on a temporary password they change at first sign-in. */
const createAdmin = async (actor: IRequestUser, input: { name: string; email: string; password: string; phone?: string }) => {
    const taken = await prisma.user.findFirst({ where: { email: { equals: input.email.trim(), mode: "insensitive" } }, select: { id: true } });
    if (taken) throw new AppError(status.CONFLICT, "An account with this email already exists.");

    logger.create("Creating admin", { email: input.email, actorId: actor.userId });
    const userId = await createStaffAccount(Role.ADMIN, input);
    const admin = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: moderatedUserSelect });
    return flattenLearner(admin);
};

/**
 * The people who administer Half Coders: every ADMIN / SUPER_ADMIN, whether or
 * not they have opened the console yet. A super admin adds admins
 * (`createAdmin`) and can suspend them.
 */
const getAdmins = async (query: IQueryParams) => {
    const result = await new QueryBuilder(prisma.user, toLearnerQuery(query) as IQueryParams, {
        searchableFields: ["name", "email"],
        filterableFields: ["learningProfile.status", "role"],
        defaultSortBy: "createdAt",
        maxLimit: 100,
    })
        .search()
        .filter()
        .sort()
        .paginate()
        .include({ learningProfile: { select: learningListSelect } })
        .where(learnerScope([Role.ADMIN, Role.SUPER_ADMIN], { requireMembership: false }))
        .execute();

    const rows = result.data as (Learner & { id: string })[];
    // When each last did something in the console — from the staff activity log.
    const lastActions = rows.length
        ? await prisma.staffActivity.groupBy({ by: ["actorId"], where: { actorId: { in: rows.map((row) => row.id) } }, _max: { createdAt: true } })
        : [];
    const lastActionOf = new Map(lastActions.map((row) => [row.actorId, row._max.createdAt]));

    return {
        ...result,
        data: rows.map((row) => ({
            ...flattenLearner(row),
            // False until they first open Half Coders — the list includes admins who never have.
            hasOpenedHalfCoders: Boolean(row.learningProfile),
            lastActionAt: lastActionOf.get(row.id) ?? null,
        })),
    };
};

export const UserService = {
    exportStudents,
    getStudents,
    getStudentCounts,
    getStudentById,
    getMentors,
    getMentorById,
    getPublicMentors,
    createMentor,
    updateMentor,
    updateMentorPhoto,
    changeUserStatus,
    createAdmin,
    changeUserRole,
    resetUserPassword,
    getAdmins,
};
