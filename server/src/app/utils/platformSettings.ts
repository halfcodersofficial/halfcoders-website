import status from "http-status";
import z from "zod";
import AppError from "../errorHelpers/AppError";
import { prisma } from "../lib/prisma";
import { logger } from "./logger";

export const SETTING_KEYS = {
    XP_RULES: "xp.rules",
    SUPPORT_SLOT_MINUTES: "support.slotMinutes",
    CERTIFICATE_PREFIX: "certificate.prefix",
    SEQUENTIAL_LEARNING: "learning.sequential",
} as const;

/**
 * The only things that earn XP — nothing else does:
 *
 * - A module finished within 24 hours of its clock starting (see
 *   `moduleOnTimeStart`): `MODULE_ON_TIME`; finished later: `MODULE_LATE`.
 * - An assignment first handed in by its deadline: `ASSIGNMENT_ON_TIME`.
 *   A late hand-in earns nothing.
 *
 * An admin can change the amounts from Settings without a redeploy.
 */
export const XP_RULE_KEYS = ["MODULE_ON_TIME", "MODULE_LATE", "ASSIGNMENT_ON_TIME"] as const;
export type XpRules = Record<(typeof XP_RULE_KEYS)[number], number>;

export const DEFAULT_XP_RULES: XpRules = {
    MODULE_ON_TIME: 2,
    MODULE_LATE: 1,
    ASSIGNMENT_ON_TIME: 3,
};

/** How long a student has to finish a module and still earn `MODULE_ON_TIME`. */
export const MODULE_ON_TIME_MS = 24 * 60 * 60 * 1000;

export const MAX_XP_AWARD = 10_000;

export const DEFAULT_SETTINGS: Record<string, unknown> = {
    [SETTING_KEYS.XP_RULES]: DEFAULT_XP_RULES,
    [SETTING_KEYS.SUPPORT_SLOT_MINUTES]: 5,
    [SETTING_KEYS.CERTIFICATE_PREFIX]: "HCC",
    // When true, a module stays locked until the previous one is complete
    // (plan §15). Off by default so early cohorts aren't blocked by a mentor
    // publishing modules out of order.
    [SETTING_KEYS.SEQUENTIAL_LEARNING]: false,
};

// Settings change rarely and are read on hot paths (every XP award, every
// learning-page load), so they are cached in-process. The TTL bounds how long
// a PM2 worker can serve a stale value after an admin edit.
const CACHE_TTL_MS = 60_000;
const cache = new Map<string, { value: unknown; expiresAt: number }>();

export const invalidateSettingCache = (key?: string) => {
    if (key) cache.delete(key);
    else cache.clear();
};

export const getSetting = async <T>(key: string, fallback: T): Promise<T> => {
    const cached = cache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
        return cached.value as T;
    }

    try {
        const row = await prisma.platformSetting.findUnique({ where: { key } });
        const value = (row?.value ?? fallback) as T;
        cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
        return value;
    } catch (error) {
        // A settings lookup must never take down the request that needed it —
        // fall back to the documented default.
        logger.error(`Failed to read platform setting "${key}"; using default`, error);
        return fallback;
    }
};

export const setSetting = async (key: string, value: unknown, description?: string) => {
    const row = await prisma.platformSetting.upsert({
        where: { key },
        create: { key, value: value as never, description },
        update: { value: value as never, ...(description ? { description } : {}) },
    });
    invalidateSettingCache(key);
    return row;
};

/**
 * Stored amounts over the defaults, one rule at a time: a rule the stored row
 * doesn't name earns its default, and anything else in the row (the old
 * per-event amounts, say) is ignored.
 */
export const getXpRules = async (): Promise<XpRules> => {
    const stored = (await getSetting<Record<string, unknown> | null>(SETTING_KEYS.XP_RULES, null)) ?? {};
    return Object.fromEntries(
        XP_RULE_KEYS.map((key) => {
            const value = stored[key];
            return [key, typeof value === "number" && Number.isFinite(value) ? value : DEFAULT_XP_RULES[key]];
        }),
    ) as XpRules;
};

export const getSupportSlotMinutes = (): Promise<number> =>
    getSetting<number>(SETTING_KEYS.SUPPORT_SLOT_MINUTES, 5);

export const getCertificatePrefix = (): Promise<string> =>
    getSetting<string>(SETTING_KEYS.CERTIFICATE_PREFIX, "HCC");

export const isSequentialLearningEnabled = (): Promise<boolean> =>
    getSetting<boolean>(SETTING_KEYS.SEQUENTIAL_LEARNING, false);

const xpAward = z.number().int().min(0).max(MAX_XP_AWARD);

/**
 * What each setting may hold — the settings endpoint takes nothing else. XP
 * rules may name only some sources; the rest keep what they had.
 */
const SETTING_SCHEMAS: Record<string, z.ZodType> = {
    [SETTING_KEYS.XP_RULES]: z
        .object(Object.fromEntries(XP_RULE_KEYS.map((key) => [key, xpAward])))
        .partial()
        .strict(),
    [SETTING_KEYS.SUPPORT_SLOT_MINUTES]: z.number().int().min(1).max(60),
    [SETTING_KEYS.CERTIFICATE_PREFIX]: z
        .string()
        .trim()
        .regex(/^[A-Z0-9]{2,12}$/, "Use 2–12 capital letters and digits — no spaces or punctuation"),
    [SETTING_KEYS.SEQUENTIAL_LEARNING]: z.boolean(),
};

export const isKnownSetting = (key: string) => key in SETTING_SCHEMAS;

export const assertKnownSetting = (key: string) => {
    if (!isKnownSetting(key)) throw new AppError(status.BAD_REQUEST, `There's no setting called "${key}".`);
};

/** Checks a value against its setting's rules and returns it as stored — XP rules complete over what's there now. */
export const parseSettingValue = async (key: string, value: unknown) => {
    assertKnownSetting(key);
    const parsed = SETTING_SCHEMAS[key].safeParse(value);
    if (!parsed.success) {
        throw new AppError(status.BAD_REQUEST, parsed.error.issues[0]?.message ?? "That value isn't valid for this setting.");
    }
    if (key === SETTING_KEYS.XP_RULES) {
        return { ...(await getXpRules()), ...(parsed.data as Partial<XpRules>) };
    }
    return parsed.data;
};
