import { createHash, randomBytes } from "crypto";
import { CookieOptions, Request, Response } from "express";
import status from "http-status";
import { AccountStatus, LearningStatus } from "../../generated/prisma/enums";
import { envVars, isProduction } from "../config/env";
import AppError from "../errorHelpers/AppError";
import { ensureLearningProfile } from "./learningProfile";
import { prisma } from "./prisma";
import { Role } from "./roles";
import { describeUserAgent } from "./userAgent";

/**
 * Half Coders' sessions. Signing in mints a random token: the browser keeps it
 * in an httpOnly cookie, the database keeps only its SHA-256 (`Session`), so a
 * leaked table can't be replayed. Every request looks the session up again,
 * which is what makes signing out — or an admin blocking someone — instant.
 *
 * Sessions last 30 days and slide: a session used with less than half of that
 * left is pushed out again, so someone who keeps coming back stays signed in.
 *
 * One account is signed in on at most MAX_DEVICES devices (a session each):
 * signing in on another one means signing out of those first.
 */

export const SESSION_COOKIE = "halfcoders.session_token";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** How many devices one account may be signed in on at the same time. */
export const MAX_DEVICES = 2;

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export interface SessionIdentity {
    userId: string;
    sessionId: string;
    name: string;
    email: string;
    image: string | null;
    phone: string | null;
    emailVerified: boolean;
    needPasswordChange: boolean;
    role: Role;
    learningStatus: LearningStatus;
}

export type SessionFailure =
    /** No credential presented at all — the normal anonymous state. */
    | "NO_CREDENTIAL"
    /** Unknown token, or an expired session. */
    | "INVALID_SESSION"
    /** Account blocked or deleted. */
    | "ACCOUNT_INACTIVE"
    /** The email hasn't been verified yet. */
    | "ACCOUNT_UNVERIFIED"
    /** Blocked from learning specifically (learning profile). */
    | "LEARNING_BLOCKED"
    /** Removed from learning specifically (learning profile). */
    | "LEARNING_REMOVED";

export type SessionResult = { ok: true; identity: SessionIdentity } | { ok: false; reason: SessionFailure };

const cookieOptions = (): CookieOptions => ({
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    ...(envVars.COOKIE_DOMAIN && { domain: envVars.COOKIE_DOMAIN }),
});

/** Signs the person in on this browser: a new session, and its cookie on the response. */
export const startSession = async (res: Response, req: Request, userId: string) => {
    const token = randomBytes(32).toString("base64url");
    const session = await prisma.session.create({
        data: {
            tokenHash: hashToken(token),
            userId,
            expiresAt: new Date(Date.now() + SESSION_TTL_MS),
            ipAddress: req.ip ?? null,
            userAgent: req.get("user-agent")?.slice(0, 500) ?? null,
        },
        select: { id: true },
    });
    res.cookie(SESSION_COOKIE, token, { ...cookieOptions(), maxAge: SESSION_TTL_MS });
    return session.id;
};

export const clearSessionCookie = (res: Response) => res.clearCookie(SESSION_COOKIE, cookieOptions());

/**
 * Parses a raw `Cookie` header. Used for Socket.IO handshakes, where there is
 * no cookie-parser; Express requests already have `req.cookies`.
 */
export const parseCookieHeader = (header: string | undefined): Record<string, string> => {
    const cookies: Record<string, string> = {};
    if (!header) return cookies;

    for (const part of header.split(";")) {
        const index = part.indexOf("=");
        if (index <= 0) continue;
        const name = part.slice(0, index).trim();
        if (!name || name in cookies) continue;
        cookies[name] = part.slice(index + 1).trim();
    }
    return cookies;
};

const safeDecode = (value: string): string => {
    try {
        return decodeURIComponent(value);
    } catch {
        return value;
    }
};

/** The session token from the cookie, or a `Bearer` header (mobile clients). */
export const extractSessionToken = (cookies: Record<string, string | undefined>, authorization: string | undefined): string | null => {
    const cookie = cookies[SESSION_COOKIE];
    if (cookie) return safeDecode(cookie);
    if (authorization?.startsWith("Bearer ")) return safeDecode(authorization.slice("Bearer ".length).trim()) || null;
    return null;
};

/** Resolves a raw session token to the caller, or explains why it can't. */
export const resolveSessionToken = async (token: string): Promise<SessionResult> => {
    const session = await prisma.session.findUnique({
        where: { tokenHash: hashToken(token) },
        select: {
            id: true,
            expiresAt: true,
            user: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                    image: true,
                    phone: true,
                    emailVerified: true,
                    needPasswordChange: true,
                    status: true,
                    isDeleted: true,
                    role: true,
                    learningProfile: { select: { status: true } },
                },
            },
        },
    });

    if (!session || session.expiresAt.getTime() <= Date.now()) return { ok: false, reason: "INVALID_SESSION" };

    const { user } = session;
    if (user.isDeleted || user.status !== AccountStatus.ACTIVE) return { ok: false, reason: "ACCOUNT_INACTIVE" };
    // Sessions are only ever started for a verified email; this guards any
    // future flow that forgets to check.
    if (!user.emailVerified) return { ok: false, reason: "ACCOUNT_UNVERIFIED" };

    const profile = user.learningProfile ?? (await ensureLearningProfile(user.id));
    if (profile.status === LearningStatus.BLOCKED) return { ok: false, reason: "LEARNING_BLOCKED" };
    if (profile.status === LearningStatus.DELETED) return { ok: false, reason: "LEARNING_REMOVED" };

    // Sliding expiry: written at most about once every two weeks per session.
    if (session.expiresAt.getTime() - Date.now() < SESSION_TTL_MS / 2) {
        await prisma.session.update({ where: { id: session.id }, data: { expiresAt: new Date(Date.now() + SESSION_TTL_MS) } });
    }

    return {
        ok: true,
        identity: {
            userId: user.id,
            sessionId: session.id,
            name: user.name,
            email: user.email,
            image: user.image,
            phone: user.phone,
            emailVerified: user.emailVerified,
            needPasswordChange: user.needPasswordChange,
            role: user.role,
            learningStatus: profile.status,
        },
    };
};

/** Authenticates an Express request. */
export const resolveRequestSession = async (req: Request): Promise<SessionResult> => {
    const token = extractSessionToken(req.cookies ?? {}, req.headers.authorization);
    if (!token) return { ok: false, reason: "NO_CREDENTIAL" };
    return resolveSessionToken(token);
};

/** Authenticates a raw `Cookie` header (Socket.IO handshakes). */
export const resolveCookieHeaderSession = async (cookieHeader: string | undefined): Promise<SessionResult> => {
    const token = extractSessionToken(parseCookieHeader(cookieHeader), undefined);
    if (!token) return { ok: false, reason: "NO_CREDENTIAL" };
    return resolveSessionToken(token);
};

/** Signs this browser out: its session is gone at once. */
export const endSession = (sessionId: string) => prisma.session.deleteMany({ where: { id: sessionId } });

/** Signs the person out everywhere — except, optionally, the session they're using. */
export const endAllSessions = (userId: string, exceptSessionId?: string) =>
    prisma.session.deleteMany({ where: { userId, ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}) } });

/** The devices the account is signed in on: its unexpired sessions, newest sign-in first, each named from its user agent. */
export const liveDevices = async (userId: string) => {
    const sessions = await prisma.session.findMany({
        where: { userId, expiresAt: { gt: new Date() } },
        orderBy: { createdAt: "desc" },
        select: { id: true, createdAt: true, ipAddress: true, userAgent: true },
    });
    return sessions.map(({ createdAt, userAgent, ...session }) => ({ ...session, signedInAt: createdAt, ...describeUserAgent(userAgent) }));
};

/**
 * Makes room for one more sign-in. An account already on MAX_DEVICES is
 * refused with DEVICE_LIMIT_EXCEEDED and the devices it's on, so the person
 * can see which — unless they've chosen to sign out of all of them and carry
 * on here. Only call this once the password has been checked: it answers with
 * the account's devices, and it can sign the account out everywhere.
 */
export const makeRoomForDevice = async (userId: string, signOutAllDevices = false) => {
    const devices = await liveDevices(userId);
    if (devices.length < MAX_DEVICES) return;

    if (signOutAllDevices) {
        await endAllSessions(userId);
        return;
    }
    throw new AppError(status.CONFLICT, `You're already signed in on ${MAX_DEVICES} devices. Sign out of them to sign in here.`).setData({
        code: "DEVICE_LIMIT_EXCEEDED",
        maxDevices: MAX_DEVICES,
        devices: devices.map(({ browser, os, deviceType, signedInAt }) => ({ browser, os, deviceType, signedInAt })),
    });
};
