/**
 * Adds the full category catalogue (src/app/utils/categoryCatalogue.ts) to the
 * database — `pnpm seed:categories`, or `pnpm seed:categories:prod` from a
 * built image.
 *
 * Only adds what's missing, matched by title; categories an admin already
 * has — their names, icons, order and on/off state — are left exactly as
 * they are. Safe to run again whenever the catalogue grows.
 */
import { prisma } from "../src/app/lib/prisma";
import { addMissingCategories, CATEGORY_CATALOGUE } from "../src/app/utils/categoryCatalogue";

const main = async () => {
    const added = await addMissingCategories();
    const total = await prisma.courseCategory.count();

    if (added.length === 0) {
        console.log(`Nothing to add — all ${CATEGORY_CATALOGUE.length} catalogue categories are already there.`);
    } else {
        console.log(`✅ Added ${added.length} categories (${total} in total):`);
        console.log(added.map((title) => `  + ${title}`).join("\n"));
    }
};

main()
    .catch((error) => {
        console.error("❌ Adding categories failed:", error);
        process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
