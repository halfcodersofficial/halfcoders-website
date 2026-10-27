import { Router } from "express";
import status from "http-status";
import z from "zod";
import { Role } from "../../lib/roles";
import { checkAuth } from "../../middleware/checkAuth";
import { validateQuery, validateRequest } from "../../middleware/validateRequest";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { prisma } from "../../lib/prisma";
import {
    assertKnownSetting,
    DEFAULT_SETTINGS,
    invalidateSettingCache,
    parseSettingValue,
    SETTING_KEYS,
    setSetting,
} from "../../utils/platformSettings";
import { nextCertificateNumber } from "../../utils/referenceNumber";

const router = Router();

const ADMINS = [Role.ADMIN, Role.SUPER_ADMIN] as const;

const upsertSettingZodSchema = z.object({
    key: z.string().trim().min(1).max(120),
    value: z.unknown(),
    description: z.string().trim().max(500).optional(),
});

const certificatePreviewQuerySchema = z.object({
    prefix: z.string().trim().regex(/^[A-Z0-9]{2,12}$/),
});

/**
 * Everything the plan marks as tunable — XP rules (§31), support slot length
 * (§25), certificate prefix (§29), sequential learning (§15): what each is now
 * (stored rows over the built-in defaults, so a fresh install still gets a
 * complete set), the defaults themselves, and when each was last changed
 * (`null` while it's still on its default).
 */
const getSettings = catchAsync(async (_req, res) => {
    const rows = await prisma.platformSetting.findMany({ where: { key: { in: Object.values(SETTING_KEYS) } } });
    const stored = Object.fromEntries(rows.map((row) => [row.key, row.value]));

    const values: Record<string, unknown> = { ...DEFAULT_SETTINGS, ...stored };
    // XP rules complete over their defaults, as the awards read them.
    values[SETTING_KEYS.XP_RULES] = {
        ...(DEFAULT_SETTINGS[SETTING_KEYS.XP_RULES] as object),
        ...((stored[SETTING_KEYS.XP_RULES] as object | undefined) ?? {}),
    };

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Settings fetched successfully",
        data: {
            values,
            defaults: DEFAULT_SETTINGS,
            changedAt: Object.fromEntries(
                Object.values(SETTING_KEYS).map((key) => [
                    key,
                    rows.find((row) => row.key === key)?.updatedAt ?? null,
                ]),
            ),
        },
    });
});

const upsertSetting = catchAsync(async (req, res) => {
    const value = await parseSettingValue(req.body.key, req.body.value);
    const result = await setSetting(req.body.key, value, req.body.description);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Setting saved successfully",
        data: result,
    });
});

const resetSetting = catchAsync(async (req, res) => {
    const key = req.params.key as string;
    assertKnownSetting(key);
    // Deleting the row is the reset: reads fall back to the built-in default.
    await prisma.platformSetting.deleteMany({ where: { key } });
    invalidateSettingCache(key);

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Setting reset to its default",
        data: null,
    });
});

/** The ID the next certificate would get under `prefix` — the count is per prefix and year. */
const previewCertificateNumber = catchAsync(async (req, res) => {
    // `validateQuery` checks the query but leaves it as sent.
    const prefix = String(req.query.prefix).trim();

    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Next certificate number",
        data: { next: await nextCertificateNumber(prefix) },
    });
});

router.get("/", checkAuth(...ADMINS), getSettings);
router.get(
    "/certificate-preview",
    checkAuth(...ADMINS),
    validateQuery(certificatePreviewQuerySchema),
    previewCertificateNumber,
);
router.put("/", checkAuth(...ADMINS), validateRequest(upsertSettingZodSchema), upsertSetting);
router.delete("/:key", checkAuth(...ADMINS), resetSetting);

export const SettingsRoutes = router;
