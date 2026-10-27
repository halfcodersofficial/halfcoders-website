import { createHmac, randomInt, timingSafeEqual } from "crypto";
import status from "http-status";
import { AuthCodePurpose } from "../../generated/prisma/enums";
import { envVars } from "../config/env";
import AppError from "../errorHelpers/AppError";
import { prisma } from "./prisma";

/**
 * One-time codes, mailed to the account's email: to verify it, or to reset the
 * password. Six digits, valid for 15 minutes, dead after five wrong tries, and
 * only the newest one counts. Stored as an HMAC keyed with AUTH_SECRET — a
 * six-digit code is too small to hash plainly, a leaked table plus a quick
 * loop would undo it.
 */

const CODE_TTL_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;
/** How soon another code can be asked for. */
const RESEND_AFTER_MS = 60 * 1000;

const digest = (code: string) => createHmac("sha256", envVars.AUTH_SECRET).update(code).digest();

/**
 * A fresh code for `purpose`; any earlier one stops working. Refuses (429) if
 * one was sent less than a minute ago.
 */
export const issueAuthCode = async (userId: string, purpose: AuthCodePurpose) => {
    const last = await prisma.authCode.findFirst({
        where: { userId, purpose },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
    });
    if (last && Date.now() - last.createdAt.getTime() < RESEND_AFTER_MS) {
        throw new AppError(status.TOO_MANY_REQUESTS, "A code was sent less than a minute ago. Check your inbox, or try again shortly.").setData({
            code: "CODE_RECENTLY_SENT",
        });
    }

    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    await prisma.$transaction([
        prisma.authCode.updateMany({ where: { userId, purpose, consumedAt: null }, data: { consumedAt: new Date() } }),
        prisma.authCode.create({
            data: { userId, purpose, codeHash: digest(code).toString("hex"), expiresAt: new Date(Date.now() + CODE_TTL_MS) },
        }),
    ]);
    return code;
};

const INVALID = "That code is wrong or has expired. Check the latest email, or ask for a new code.";

/** Checks a code and uses it up. Throws 400 on a wrong, used, expired or worn-out code. */
export const consumeAuthCode = async (userId: string, purpose: AuthCodePurpose, code: string) => {
    const current = await prisma.authCode.findFirst({
        where: { userId, purpose, consumedAt: null },
        orderBy: { createdAt: "desc" },
    });
    if (!current || current.expiresAt.getTime() <= Date.now()) {
        throw new AppError(status.BAD_REQUEST, INVALID).setData({ code: "INVALID_CODE" });
    }
    if (current.attempts >= MAX_ATTEMPTS) {
        throw new AppError(status.BAD_REQUEST, "Too many wrong tries for this code. Ask for a new one.").setData({ code: "CODE_LOCKED" });
    }

    const given = digest(code);
    const stored = Buffer.from(current.codeHash, "hex");
    if (given.length !== stored.length || !timingSafeEqual(given, stored)) {
        await prisma.authCode.update({ where: { id: current.id }, data: { attempts: { increment: 1 } } });
        throw new AppError(status.BAD_REQUEST, INVALID).setData({ code: "INVALID_CODE" });
    }

    // Conditional, so two requests racing with the right code can't both use it.
    const used = await prisma.authCode.updateMany({ where: { id: current.id, consumedAt: null }, data: { consumedAt: new Date() } });
    if (used.count === 0) throw new AppError(status.BAD_REQUEST, INVALID).setData({ code: "INVALID_CODE" });
};
