import { Prisma } from "../../generated/prisma/client";
import { prisma } from "../lib/prisma";

/**
 * Human-facing reference numbers ("HC-2026-000124", "HCC-CE-2026-000125").
 *
 * These are derived from the highest existing number for the year rather than
 * a database sequence, which keeps them gap-free and readable. Two concurrent
 * requests can compute the same value, so every caller must be prepared to
 * retry — `withUniqueRetry` below wraps that.
 */

const YEAR_PATTERN = /-(\d+)$/;

const nextNumberFrom = (latest: string | null | undefined): number => {
    const match = latest?.match(YEAR_PATTERN);
    return match ? Number(match[1]) + 1 : 1;
};

/**
 * Pass the transaction when numbering several orders in one — it sees the
 * orders it has already created there; the plain client wouldn't.
 */
export const nextOrderNumber = async (client: Prisma.TransactionClient = prisma): Promise<string> => {
    const year = new Date().getFullYear();
    const prefix = `HC-${year}-`;

    const latest = await client.order.findFirst({
        where: { orderNumber: { startsWith: prefix } },
        orderBy: { orderNumber: "desc" },
        select: { orderNumber: true },
    });

    return `${prefix}${String(nextNumberFrom(latest?.orderNumber)).padStart(6, "0")}`;
};

export const BUNDLE_ORDER_PREFIX = "HCB-";

/** A bundle checkout's number — its own series, so the gateway can tell it from a course order. */
export const nextBundleOrderNumber = async (): Promise<string> => {
    const prefix = `${BUNDLE_ORDER_PREFIX}${new Date().getFullYear()}-`;

    const latest = await prisma.bundleOrder.findFirst({
        where: { orderNumber: { startsWith: prefix } },
        orderBy: { orderNumber: "desc" },
        select: { orderNumber: true },
    });

    return `${prefix}${String(nextNumberFrom(latest?.orderNumber)).padStart(6, "0")}`;
};

/**
 * The course's certificate code, when it has one, goes between the prefix and
 * the year, and numbers count per course code. Codes start with a letter, so
 * "HCC-2026-" (no code) can never be the start of a coded ID.
 */
export const nextCertificateNumber = async (prefix: string, courseCode?: string | null): Promise<string> => {
    const year = new Date().getFullYear();
    const fullPrefix = `${courseCode ? `${prefix}-${courseCode}` : prefix}-${year}-`;

    const latest = await prisma.certificate.findFirst({
        where: { certificateNo: { startsWith: fullPrefix } },
        orderBy: { certificateNo: "desc" },
        select: { certificateNo: true },
    });

    return `${fullPrefix}${String(nextNumberFrom(latest?.certificateNo)).padStart(6, "0")}`;
};

/**
 * Runs `operation` and retries when it fails on a unique-constraint violation,
 * which is how a reference-number collision surfaces. Bounded so a genuine,
 * unrelated conflict still fails instead of looping forever.
 */
export const withUniqueRetry = async <T>(
    operation: () => Promise<T>,
    attempts = 5,
): Promise<T> => {
    let lastError: unknown;

    for (let attempt = 0; attempt < attempts; attempt += 1) {
        try {
            return await operation();
        } catch (error) {
            const code = (error as { code?: string }).code;
            if (code !== "P2002") throw error;
            lastError = error;
        }
    }

    throw lastError;
};
