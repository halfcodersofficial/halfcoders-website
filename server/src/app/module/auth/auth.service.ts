import status from "http-status";
import { Prisma } from "../../../generated/prisma/client";
import { AccountStatus, AuthCodePurpose, LearningStatus } from "../../../generated/prisma/enums";
import { deleteFileFromCloudinary, isOwnCloudinaryAsset, uploadFileToCloudinary } from "../../config/cloudinary.config";
import AppError from "../../errorHelpers/AppError";
import { IRequestUser } from "../../interfaces/requestUser.interface";
import { consumeAuthCode, issueAuthCode, withdrawAuthCode } from "../../lib/authCodes";
import { exchangeGoogleCode, GoogleIdentity, verifyGoogleCredential } from "../../lib/google";
import { burnPasswordCheck, hashPassword, verifyPassword } from "../../lib/password";
import { prisma } from "../../lib/prisma";
import { Role } from "../../lib/roles";
import { endAllSessions, endSession, liveDevices, makeRoomForDevice, MAX_DEVICES } from "../../lib/session";
import { sendEmail } from "../../utils/email";
import { logger } from "../../utils/logger";
import { assertRealEmail } from "../../utils/realEmail";

/**
 * Half Coders accounts: signing up, verifying the email, signing in, the
 * devices the account is signed in on, and looking after the password — plus
 * the signed-in person's own profile.
 *
 * Sessions themselves (the cookie, resolving it on each request) are in
 * lib/session.ts; the controller starts one once a sign-in here succeeds.
 */

const CODE_EMAIL = {
    [AuthCodePurpose.VERIFY_EMAIL]: {
        subject: "Your Half Coders verification code",
        title: "Verify your email",
        message: "Welcome to Half Coders! Enter this code to verify your email and finish signing up.",
    },
    [AuthCodePurpose.RESET_PASSWORD]: {
        subject: "Your Half Coders password reset code",
        title: "Reset your password",
        message: "Enter this code to choose a new password for your Half Coders account.",
    },
} as const;

/**
 * Mails a fresh one-time code (lib/authCodes.ts) for `purpose`, and waits for
 * the mail to go: if it can't, the code is taken back and the person told
 * (503), rather than left waiting for an email that isn't coming.
 */
const sendAuthCode = async (user: { id: string; email: string }, purpose: AuthCodePurpose) => {
    const code = await issueAuthCode(user.id, purpose);
    const copy = CODE_EMAIL[purpose];
    try {
        await sendEmail({ to: user.email, subject: copy.subject, templateName: "code", templateData: { title: copy.title, message: copy.message, code } });
    } catch (error) {
        logger.error(`Email send failed (${purpose.toLowerCase()} code)`, error);
        await withdrawAuthCode(user.id, purpose);
        throw new AppError(status.SERVICE_UNAVAILABLE, "We couldn't send the email just now. Please try again in a minute.").setData({
            code: "EMAIL_NOT_SENT",
        });
    }
};

/** The same, for flows that answer the same way whatever happens: a too-soon resend is just skipped. */
const sendAuthCodeQuietly = async (user: { id: string; email: string }, purpose: AuthCodePurpose) => {
    try {
        await sendAuthCode(user, purpose);
    } catch (error) {
        if (!(error instanceof AppError && error.statusCode === status.TOO_MANY_REQUESTS)) throw error;
    }
};

const ACCOUNT_SELECT = {
    id: true,
    email: true,
    passwordHash: true,
    googleId: true,
    image: true,
    emailVerified: true,
    status: true,
    isDeleted: true,
    learningProfile: { select: { status: true } },
} satisfies Prisma.UserSelect;

const findByEmail = (email: string) => prisma.user.findUnique({ where: { email }, select: ACCOUNT_SELECT });

/** Refuses an account that may not sign in, with the same codes checkAuth uses. */
const assertCanSignIn = (account: NonNullable<Awaited<ReturnType<typeof findByEmail>>>) => {
    if (account.isDeleted || account.status !== AccountStatus.ACTIVE) {
        throw new AppError(status.FORBIDDEN, "Your account is not active. Please contact support.").setData({ code: "ACCOUNT_INACTIVE" });
    }
    if (account.learningProfile?.status === LearningStatus.BLOCKED) {
        throw new AppError(status.FORBIDDEN, "Your Half Coders access has been blocked. Please contact support.").setData({ code: "LEARNING_BLOCKED" });
    }
    if (account.learningProfile?.status === LearningStatus.DELETED) {
        throw new AppError(status.FORBIDDEN, "Your Half Coders access has been removed. Please contact support.").setData({ code: "LEARNING_REMOVED" });
    }
};

// ---------------------------------------------------------------------------
// Signing up and verifying the email
// ---------------------------------------------------------------------------

interface RegisterPayload {
    name: string;
    email: string;
    phone: string;
    password: string;
}

/**
 * Creates a student account and mails a code to verify the email; signing in
 * waits for that. Someone who signs up again before verifying (a typo in the
 * name, a lost code) simply updates the details and gets a new code.
 */
const register = async ({ name, email, phone, password }: RegisterPayload) => {
    await assertRealEmail(email);

    const existing = await prisma.user.findUnique({ where: { email }, select: { id: true, emailVerified: true } });
    if (existing?.emailVerified) {
        throw new AppError(status.CONFLICT, "An account with this email already exists. Sign in instead.").setData({ code: "EMAIL_TAKEN" });
    }
    const phoneOwner = await prisma.user.findUnique({ where: { phone }, select: { id: true } });
    if (phoneOwner && phoneOwner.id !== existing?.id) {
        throw new AppError(status.CONFLICT, "This mobile number is already used by another account.").setData({ code: "PHONE_TAKEN" });
    }

    const passwordHash = await hashPassword(password);
    const user = existing
        ? await prisma.user.update({ where: { id: existing.id }, data: { name, phone, passwordHash }, select: { id: true, email: true } })
        : await prisma.user.create({
              data: { name, email, phone, passwordHash, role: Role.STUDENT, learningProfile: { create: { whatsapp: phone } } },
              select: { id: true, email: true },
          });
    if (!existing) logger.create("Account created", { userId: user.id });

    await sendAuthCodeQuietly(user, AuthCodePurpose.VERIFY_EMAIL);
    return { email: user.email };
};

/**
 * Verifies the email with its code. Returns the account to sign in. An email
 * already verified has no code left to check, so it's refused like a wrong
 * code — answering it with a session would sign anyone in who knew the address.
 */
const verifyEmail = async ({ email, code }: { email: string; code: string }) => {
    const account = await findByEmail(email);
    if (!account || account.emailVerified) {
        throw new AppError(status.BAD_REQUEST, "That code is wrong or has expired.").setData({ code: "INVALID_CODE" });
    }
    await consumeAuthCode(account.id, AuthCodePurpose.VERIFY_EMAIL, code);
    await prisma.user.update({ where: { id: account.id }, data: { emailVerified: true } });
    assertCanSignIn(account);
    return account.id;
};

/** Another verification code. Answers the same way whether or not the email is on file. */
const resendVerification = async ({ email }: { email: string }) => {
    const account = await findByEmail(email);
    if (account && !account.emailVerified) await sendAuthCode(account, AuthCodePurpose.VERIFY_EMAIL);
};

// ---------------------------------------------------------------------------
// Signing in
// ---------------------------------------------------------------------------

/**
 * Checks the email and password. Returns the account to sign in; an
 * unverified email gets a fresh code and a 403 the client turns into the
 * verify step. An account already on every device it may use gets a 409 the
 * client turns into the device-limit step, which comes back with
 * `signOutAllDevices` once the person agrees.
 */
const login = async ({ email, password, signOutAllDevices }: { email: string; password: string; signOutAllDevices?: boolean }) => {
    const account = await findByEmail(email);
    if (!account) {
        await burnPasswordCheck(password);
        throw new AppError(status.UNAUTHORIZED, "Wrong email or password.").setData({ code: "INVALID_CREDENTIALS" });
    }
    if (!(await verifyPassword(password, account.passwordHash))) {
        throw new AppError(status.UNAUTHORIZED, "Wrong email or password.").setData({ code: "INVALID_CREDENTIALS" });
    }
    assertCanSignIn(account);
    if (!account.emailVerified) {
        await sendAuthCodeQuietly(account, AuthCodePurpose.VERIFY_EMAIL);
        throw new AppError(status.FORBIDDEN, "Verify your email first — we've sent you a code.").setData({ code: "EMAIL_NOT_VERIFIED", email: account.email });
    }
    await makeRoomForDevice(account.id, signOutAllDevices);
    return account.id;
};

// ---------------------------------------------------------------------------
// Signing in with Google
// ---------------------------------------------------------------------------

/**
 * Signs in with Google (lib/google.ts): the code from Google's sign-in popup,
 * or an ID token. The account is the one already linked to that Google
 * account; else the one with its email, which gets linked; else a new student
 * account — its email needs no code, Google has verified it. Returns the
 * account to sign in and whether it was just made.
 *
 * The device limit works as for a password sign-in: a 409, then the same
 * sign-in again with `signOutAllDevices`. A code works only once, so its 409
 * carries the ID token (`credential`) to come back with.
 */
const googleSignIn = async ({ code, credential, signOutAllDevices }: { code?: string; credential?: string; signOutAllDevices?: boolean }) => {
    let google: GoogleIdentity;
    let idToken: string | undefined;
    if (code) {
        ({ identity: google, idToken } = await exchangeGoogleCode(code));
    } else {
        google = await verifyGoogleCredential(credential as string);
    }

    const account =
        (await prisma.user.findUnique({ where: { googleId: google.sub }, select: ACCOUNT_SELECT })) ?? (await findByEmail(google.email));

    if (!account) {
        await assertRealEmail(google.email);
        const user = await prisma.user.create({
            data: {
                name: google.name,
                email: google.email,
                emailVerified: true,
                image: google.picture,
                googleId: google.sub,
                role: Role.STUDENT,
                learningProfile: { create: {} },
            },
            select: { id: true },
        });
        logger.create("Account created with Google", { userId: user.id });
        return { userId: user.id, isNewAccount: true };
    }

    if (account.googleId && account.googleId !== google.sub) {
        throw new AppError(
            status.CONFLICT,
            "This email's account is linked to a different Google account. Sign in with that one, or with your email and password.",
        ).setData({ code: "GOOGLE_ACCOUNT_MISMATCH" });
    }
    assertCanSignIn(account);

    if (!account.googleId || !account.emailVerified) {
        await prisma.user.update({
            where: { id: account.id },
            data: {
                googleId: google.sub,
                // Nobody had proved this inbox yet, so the password was chosen by
                // whoever typed the address at sign-up — maybe not its owner.
                // Google has proved it now; that password mustn't open the account.
                ...(!account.emailVerified && { emailVerified: true, passwordHash: null }),
                ...(!account.image && google.picture && { image: google.picture }),
            },
        });
        logger.update("Google account linked", { userId: account.id });
    }

    try {
        await makeRoomForDevice(account.id, signOutAllDevices);
    } catch (error) {
        if (idToken && error instanceof AppError && error.statusCode === status.CONFLICT) {
            error.setData({ ...(error.data as object), credential: idToken });
        }
        throw error;
    }
    return { userId: account.id, isNewAccount: false };
};

// ---------------------------------------------------------------------------
// The devices the account is signed in on
// ---------------------------------------------------------------------------

/** Every device the account is signed in on, with the one asking marked `current`, and how many it may use. */
const listDevices = async (user: IRequestUser) => ({
    maxDevices: MAX_DEVICES,
    devices: (await liveDevices(user.userId)).map((device) => ({ ...device, current: device.id === user.sessionId })),
});

/** Signs one of the account's other devices out. This one leaves through the usual sign-out. */
const signOutDevice = async (user: IRequestUser, sessionId: string) => {
    if (sessionId === user.sessionId) {
        throw new AppError(status.BAD_REQUEST, "That's the device you're using — sign out from the menu instead.");
    }
    const session = await prisma.session.findFirst({ where: { id: sessionId, userId: user.userId }, select: { id: true } });
    if (!session) throw new AppError(status.NOT_FOUND, "That device isn't signed in any more.");
    await endSession(session.id);
    logger.update("Device signed out", { userId: user.userId, sessionId });
};

/** Signs every device but this one out. */
const signOutOtherDevices = async (user: IRequestUser) => {
    const { count } = await endAllSessions(user.userId, user.sessionId);
    logger.update("Other devices signed out", { userId: user.userId, count });
    return { signedOut: count };
};

// ---------------------------------------------------------------------------
// Passwords
// ---------------------------------------------------------------------------

/** Mails a reset code. Answers the same way whether or not the email is on file. */
const forgotPassword = async ({ email }: { email: string }) => {
    const account = await findByEmail(email);
    if (account && !account.isDeleted && account.status === AccountStatus.ACTIVE) {
        // A mail failure is only logged here: a 503 would tell that the email is on file.
        await sendAuthCodeQuietly(account, AuthCodePurpose.RESET_PASSWORD).catch((error) => {
            if (!(error instanceof AppError && error.statusCode === status.SERVICE_UNAVAILABLE)) throw error;
        });
    }
};

/**
 * Sets a new password with a reset code. Every session ends (whoever had the
 * old password is out), the code proves the inbox so the email counts as
 * verified, and the account is returned to sign in afresh.
 */
const resetPassword = async ({ email, code, password }: { email: string; code: string; password: string }) => {
    const account = await findByEmail(email);
    if (!account) throw new AppError(status.BAD_REQUEST, "That code is wrong or has expired.").setData({ code: "INVALID_CODE" });
    await consumeAuthCode(account.id, AuthCodePurpose.RESET_PASSWORD, code);
    await prisma.user.update({
        where: { id: account.id },
        data: { passwordHash: await hashPassword(password), needPasswordChange: false, emailVerified: true },
    });
    await endAllSessions(account.id);
    logger.update("Password reset", { userId: account.id });
    assertCanSignIn(account);
    return account.id;
};

/** Changes the password from inside the account; every other session ends. */
const changePassword = async (user: IRequestUser, { currentPassword, newPassword }: { currentPassword: string; newPassword: string }) => {
    const account = await prisma.user.findUniqueOrThrow({ where: { id: user.userId }, select: { passwordHash: true } });
    if (!account.passwordHash) {
        throw new AppError(status.BAD_REQUEST, "Your account has no password yet. Set one with a code sent to your email.").setData({
            code: "NO_PASSWORD",
        });
    }
    if (!(await verifyPassword(currentPassword, account.passwordHash))) {
        throw new AppError(status.BAD_REQUEST, "Your current password is wrong.").setData({ code: "INVALID_CREDENTIALS" });
    }
    await prisma.user.update({
        where: { id: user.userId },
        data: { passwordHash: await hashPassword(newPassword), needPasswordChange: false },
    });
    await endAllSessions(user.userId, user.sessionId);
};

/**
 * An admin asking for someone's password to be reset: they're mailed a reset
 * code, and set the new password themselves. Nobody else ever sees it.
 */
export const sendPasswordResetFor = async (account: { id: string; email: string }) => sendAuthCode(account, AuthCodePurpose.RESET_PASSWORD);

// ---------------------------------------------------------------------------
// The signed-in person's own profile
// ---------------------------------------------------------------------------

/** `HC-######` — collides rarely enough that a handful of retries is plenty. */
const generateStudentId = (): string => `HC-${Math.floor(100000 + Math.random() * 900000)}`;

/**
 * Assigns a display id the first time a student's own profile is fetched,
 * rather than backfilling every profile up front — new and existing students
 * converge on having one the same way. Mentors/admins never get one.
 */
export const ensureStudentId = async (userId: string, role: Role): Promise<string | null> => {
    if (role !== Role.STUDENT) return null;

    for (let attempt = 0; attempt < 5; attempt++) {
        try {
            const updated = await prisma.learningProfile.update({
                where: { userId },
                data: { studentId: generateStudentId() },
                select: { studentId: true },
            });
            return updated.studentId;
        } catch (error) {
            // P2002 = unique constraint hit — another student already has this
            // id, try a fresh one rather than failing the whole profile fetch.
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
                continue;
            }
            throw error;
        }
    }

    logger.warn("Could not assign a unique studentId after 5 attempts", { userId });
    return null;
};

const loadMe = (userId: string) =>
    prisma.user.findUnique({
        where: { id: userId },
        select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            image: true,
            emailVerified: true,
            phoneVerified: true,
            needPasswordChange: true,
            // Only to say whether there is one; never sent.
            passwordHash: true,
            createdAt: true,
            role: true,
            learningProfile: {
                select: {
                    status: true,
                    studentId: true,
                    whatsapp: true,
                    bio: true,
                    address: true,
                    preferences: true,
                    createdAt: true,
                },
            },
            mentorProfile: true,
            _count: { select: { enrollments: true, certificates: true } },
        },
    });

/**
 * The combined profile: the account plus its learning profile, flattened into
 * the shape the client has always used (`role`, `studentId`, `bio`… at the
 * top level).
 */
const getMe = async (user: IRequestUser) => {
    const record = await loadMe(user.userId);

    if (!record?.learningProfile) {
        throw new AppError(status.NOT_FOUND, "Account not found.");
    }

    const { learningProfile, passwordHash, ...account } = record;
    let studentId = learningProfile.studentId;

    if (!studentId && account.role === Role.STUDENT) {
        studentId = await ensureStudentId(account.id, account.role);
    }

    return {
        ...account,
        /** False for an account made with Google that hasn't set a password. */
        hasPassword: passwordHash !== null,
        status: learningProfile.status,
        studentId,
        whatsapp: learningProfile.whatsapp,
        bio: learningProfile.bio,
        address: learningProfile.address,
        preferences: learningProfile.preferences,
        learnerSince: learningProfile.createdAt,
    };
};

interface UpdateProfilePayload {
    name?: string;
    phone?: string;
    whatsapp?: string;
    bio?: string;
    address?: string;
}

/** Name and mobile number on the account; the rest is learning-profile data. */
const updateProfile = async (user: IRequestUser, payload: UpdateProfilePayload) => {
    const { name, phone, ...learning } = payload;

    if (phone !== undefined) {
        const owner = await prisma.user.findUnique({ where: { phone }, select: { id: true } });
        if (owner && owner.id !== user.userId) {
            throw new AppError(status.CONFLICT, "This mobile number is already used by another account.").setData({ code: "PHONE_TAKEN" });
        }
    }
    if (name !== undefined || phone !== undefined) {
        await prisma.user.update({ where: { id: user.userId }, data: { name, phone } });
    }
    if (Object.keys(learning).length > 0) {
        await prisma.learningProfile.update({ where: { userId: user.userId }, data: learning });
    }

    return getMe(user);
};

/**
 * Swaps the profile photo — any role's own. The file arrives in memory with
 * its bytes already checked against its type (`verifyFileSignatures`); here
 * it's held to images, uploaded, and only then saved, the way an admin sets a
 * mentor's photo (user.service.ts).
 */
const updateAvatar = async (user: IRequestUser, file: { buffer: Buffer; originalname: string; mimetype: string }) => {
    // The shared upload middleware also lets PDFs through.
    if (!file.mimetype.startsWith("image/")) {
        throw new AppError(status.BAD_REQUEST, "Upload a JPEG, PNG or WebP image.");
    }

    const existing = await prisma.user.findUnique({ where: { id: user.userId }, select: { image: true } });
    const { secure_url: url } = await uploadFileToCloudinary(file.buffer, file.originalname);

    let updated;
    try {
        updated = await prisma.user.update({
            where: { id: user.userId },
            data: { image: url },
            select: { id: true, name: true, image: true },
        });
    } catch (error) {
        // Not saved — nothing points at the new upload.
        void deleteFileFromCloudinary(url);
        throw error;
    }

    // Only clean up a photo Half Coders uploaded.
    if (existing?.image && existing.image !== url && isOwnCloudinaryAsset(existing.image)) {
        void deleteFileFromCloudinary(existing.image);
    }

    return updated;
};

interface HealthCautionCategories {
    eyeCare?: boolean;
    goodPosture?: boolean;
    meditation?: boolean;
    stretching?: boolean;
    screenBreak?: boolean;
}

interface UpdatePreferencesPayload {
    healthCaution?: {
        enabled?: boolean;
        intervalMinutes?: number;
        categories?: HealthCautionCategories;
    };
    emailPreference?: boolean;
}

/**
 * Merges rather than replaces: the Health Caution and Email Preference panels
 * each save independently (one toggle click at a time), so a request that
 * only touches `healthCaution.categories.eyeCare` must not wipe out the rest
 * of `healthCaution` — or `emailPreference` — that a previous save wrote.
 */
const updatePreferences = async (user: IRequestUser, payload: UpdatePreferencesPayload) => {
    const existing = await prisma.learningProfile.findUnique({
        where: { userId: user.userId },
        select: { preferences: true },
    });

    const current = (existing?.preferences ?? {}) as UpdatePreferencesPayload;

    const merged: UpdatePreferencesPayload = {
        ...current,
        ...payload,
        healthCaution: payload.healthCaution
            ? {
                ...current.healthCaution,
                ...payload.healthCaution,
                categories: {
                    ...current.healthCaution?.categories,
                    ...payload.healthCaution.categories,
                },
            }
            : current.healthCaution,
    };

    const profile = await prisma.learningProfile.update({
        where: { userId: user.userId },
        // `UpdatePreferencesPayload` has no index signature, which is all
        // Prisma's `InputJsonValue` actually requires — the shape itself is
        // already validated by `updatePreferencesZodSchema` on the way in.
        data: { preferences: merged as object as Prisma.InputJsonValue },
        select: { preferences: true, updatedAt: true },
    });

    return { id: user.userId, role: user.role, ...profile };
};

export const AuthService = {
    register,
    verifyEmail,
    resendVerification,
    login,
    googleSignIn,
    listDevices,
    signOutDevice,
    signOutOtherDevices,
    forgotPassword,
    resetPassword,
    changePassword,
    getMe,
    updateProfile,
    updateAvatar,
    updatePreferences,
};
