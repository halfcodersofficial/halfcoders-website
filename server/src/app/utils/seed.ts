import { Role } from "../../generated/prisma/enums";
import { hashPassword } from "../lib/password";
import { prisma } from "../lib/prisma";
import { addMissingCategories } from "./categoryCatalogue";
import { seedInitialCatalogue } from "./initialCatalogue";
import { logger } from "./logger";
import { DEFAULT_SETTINGS } from "./platformSettings";

/**
 * Writes the documented defaults for every tunable so the admin settings
 * screen has real rows to edit. Existing values are never overwritten — an
 * admin's tuning must survive a restart.
 */
export const seedPlatformSettings = async () => {
    for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
        const existing = await prisma.platformSetting.findUnique({
            where: { key },
            select: { id: true },
        });
        if (existing) continue;

        await prisma.platformSetting.create({
            data: { key, value: value as never, description: "Default value seeded on first boot" },
        });
    }
};

export interface SuperAdminConfig {
    name: string;
    email: string;
    password: string;
}

/**
 * SUPER_ADMIN_NAME / _EMAIL / _PASSWORD, checked — or null when the email or
 * password isn't set. A password too weak for the sign-up rules throws: the
 * account would be the one with the most power, so it gets no exemption.
 */
export const superAdminFromEnv = (): SuperAdminConfig | null => {
    const name = process.env.SUPER_ADMIN_NAME?.trim() || "Half Coders Admin";
    const email = process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase();
    const password = process.env.SUPER_ADMIN_PASSWORD;
    if (!email || !password) return null;
    if (password.length < 8 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
        throw new Error("SUPER_ADMIN_PASSWORD needs 8+ characters with a lowercase letter, an uppercase letter and a number.");
    }
    return { name, email, password };
};

/** A new SUPER_ADMIN, email already verified, with the learning profile every account has. */
export const createSuperAdmin = async ({ name, email, password }: SuperAdminConfig) =>
    prisma.user.create({
        data: {
            name,
            email,
            role: Role.SUPER_ADMIN,
            emailVerified: true,
            passwordHash: await hashPassword(password),
            learningProfile: { create: {} },
        },
        select: { id: true },
    });

/**
 * The first super admin, on boot: created when no account has
 * SUPER_ADMIN_EMAIL yet. An account that already has it is left exactly as it
 * is — its password, its role, a suspension — so a restart never undoes what
 * someone did to it in the console. (`pnpm seed:admin` is the deliberate way
 * to promote one.)
 */
const seedSuperAdmin = async () => {
    const admin = superAdminFromEnv();
    if (!admin) {
        logger.warn("SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD not set — no super admin created on boot");
        return;
    }

    const existing = await prisma.user.findUnique({ where: { email: admin.email }, select: { id: true } });
    if (existing) return;

    await createSuperAdmin(admin);
    logger.info(`Created super admin ${admin.email}`);
};

/**
 * Marks a database as having had its starter content. A platform-setting row
 * so it needs no table of its own; the settings screen lists only the keys it
 * knows, so admins never see it.
 */
const STARTER_CONTENT_KEY = "system.starterContentSeeded";

/**
 * The category catalogue and the first courses with the Career Launchpad
 * bundle — once per database. After that they belong to the admins: a
 * category deleted, a course renamed, stays that way across restarts, which
 * re-adding missing titles on every boot would undo. The catalogue scripts
 * (`pnpm seed:categories`, `pnpm seed:catalogue`) add anything missing on
 * purpose, later.
 *
 * Both steps only add what isn't there, so a boot that dies half-way just
 * finishes the job next time: the marker is written last.
 */
const seedStarterContent = async () => {
    const done = await prisma.platformSetting.findUnique({ where: { key: STARTER_CONTENT_KEY }, select: { id: true } });
    if (done) return;

    const categories = await addMissingCategories();
    const catalogue = await seedInitialCatalogue();

    await prisma.platformSetting.create({
        data: {
            key: STARTER_CONTENT_KEY,
            value: { at: new Date().toISOString(), categories: categories.length, courses: catalogue.created.length },
            description: "Starter categories and courses added on first boot",
        },
    });
    logger.info(
        `Starter content added: ${categories.length} categories, ${catalogue.created.length} courses` +
            (catalogue.bundle === "created" ? ", the Career Launchpad bundle" : ""),
    );
};

/**
 * Everything a fresh database needs to be usable, run on every boot and
 * idempotent: the settings defaults, the first super admin, the starter
 * categories and courses. Each step is convenience data, so a failure is
 * logged and never blocks startup — nor the steps after it.
 */
export const seedOnBoot = async () => {
    const steps: [string, () => Promise<void>][] = [
        ["Platform settings", seedPlatformSettings],
        ["Super admin", seedSuperAdmin],
        ["Starter content", seedStarterContent],
    ];

    for (const [name, step] of steps) {
        try {
            await step();
        } catch (error) {
            logger.warn(`${name} seeding failed (non-fatal)`, error instanceof Error ? error.message : error);
        }
    }
};
