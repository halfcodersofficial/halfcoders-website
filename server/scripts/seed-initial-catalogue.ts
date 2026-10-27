/**
 * Adds Half Coders' first 8 courses and the Career Launchpad bundle
 * (src/app/utils/initialCatalogue.ts) — `pnpm seed:catalogue`, or
 * `pnpm seed:catalogue:prod` from a built image.
 *
 * Only adds what's missing, matched by title; anything already there is left
 * exactly as it is. Safe to run again.
 */
import { prisma } from "../src/app/lib/prisma";
import { INITIAL_COURSES, seedInitialCatalogue } from "../src/app/utils/initialCatalogue";

const main = async () => {
    const report = await seedInitialCatalogue();

    if (report.created.length === 0) {
        console.log(`Nothing to add — all ${INITIAL_COURSES.length} courses are already there.`);
    } else {
        console.log(`✅ Added ${report.created.length} draft courses:`);
        console.log(report.created.map((title) => `  + ${title}`).join("\n"));
    }
    console.log(report.bundle === "created" ? "✅ Added the Career Launchpad bundle (switched off, not priced yet)." : "Career Launchpad is already there.");
};

main()
    .catch((error) => {
        console.error("❌ Seeding the catalogue failed:", error);
        process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
