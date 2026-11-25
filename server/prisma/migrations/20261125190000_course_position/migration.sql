-- Courses get a place in the catalogue that an admin sets by dragging the
-- course list. Filled in with the order the catalogue already shows —
-- featured first, then newest — so nothing moves until someone reorders.
-- Deleted courses keep 0; they're never listed.

-- AlterTable
ALTER TABLE "learning"."course" ADD COLUMN     "position" INTEGER NOT NULL DEFAULT 0;

-- Backfill
UPDATE "learning"."course" AS c
SET "position" = ranked."place"
FROM (
    SELECT "id", ROW_NUMBER() OVER (ORDER BY "isFeatured" DESC, "createdAt" DESC) AS "place"
    FROM "learning"."course"
    WHERE "isDeleted" = false
) AS ranked
WHERE c."id" = ranked."id";
