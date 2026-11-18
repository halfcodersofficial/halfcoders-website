-- A module's quiz can sit between its lessons, not only after them: `position`
-- is how many of the module's lessons come before it. Null keeps every
-- existing quiz where it was — after all the lessons — so nothing to backfill.
--
-- And a quiz question can carry a picture (code, a diagram, some output) next
-- to its text.

-- AlterTable
ALTER TABLE "learning"."quiz" ADD COLUMN "position" INTEGER;

-- AlterTable
ALTER TABLE "learning"."quiz_question" ADD COLUMN "imageUrl" TEXT;
