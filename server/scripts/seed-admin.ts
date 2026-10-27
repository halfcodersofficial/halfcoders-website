/**
 * `pnpm seed:admin` (or `pnpm seed:admin:prod` from a built image) — creates
 * the first SUPER_ADMIN from SUPER_ADMIN_NAME / SUPER_ADMIN_EMAIL /
 * SUPER_ADMIN_PASSWORD, or brings an existing account with that email up to
 * SUPER_ADMIN. The password is only set for a new account; an existing one
 * keeps its own. Safe to run again.
 *
 * The server creates the account on boot too (utils/seed.ts), but never
 * touches one that exists — promoting is what this script is for.
 */
import { AccountStatus, Role } from "../src/generated/prisma/enums";
import { prisma } from "../src/app/lib/prisma";
import { createSuperAdmin, superAdminFromEnv } from "../src/app/utils/seed";

const main = async () => {
    const admin = superAdminFromEnv();
    if (!admin) throw new Error("Set SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD (and optionally SUPER_ADMIN_NAME).");

    const existing = await prisma.user.findUnique({ where: { email: admin.email }, select: { id: true } });
    if (existing) {
        await prisma.user.update({
            where: { id: existing.id },
            data: { role: Role.SUPER_ADMIN, status: AccountStatus.ACTIVE, isDeleted: false, emailVerified: true },
        });
        await prisma.learningProfile.upsert({ where: { userId: existing.id }, create: { userId: existing.id }, update: {} });
        console.log(`✅ ${admin.email} is now a super admin (password unchanged).`);
        return;
    }

    await createSuperAdmin(admin);
    console.log(`✅ Created super admin ${admin.email}. Sign in with SUPER_ADMIN_PASSWORD.`);
};

main()
    .catch((error) => {
        console.error(`❌ ${error instanceof Error ? error.message : error}`);
        process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
