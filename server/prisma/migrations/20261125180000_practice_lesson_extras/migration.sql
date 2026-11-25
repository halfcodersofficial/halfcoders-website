-- A practice day's lessons get what a module's lessons have under them: the
-- student's note, bookmark and like/dislike, and questions for the mentors.
-- The same three tables carry them, each row pointing at either a module
-- lesson (`videoId`) or a practice day's lesson (`practiceMaterialId`) —
-- exactly one, which the CHECKs hold. Existing rows all have a `videoId`, so
-- nothing to backfill.

-- AlterTable
ALTER TABLE "learning"."lesson_note" ADD COLUMN     "practiceMaterialId" TEXT,
ALTER COLUMN "videoId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "learning"."lesson_interaction" ADD COLUMN     "practiceMaterialId" TEXT,
ALTER COLUMN "videoId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "learning"."lesson_question" ADD COLUMN     "practiceMaterialId" TEXT,
ALTER COLUMN "videoId" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "lesson_note_studentId_practiceMaterialId_key" ON "learning"."lesson_note"("studentId", "practiceMaterialId");

-- CreateIndex
CREATE UNIQUE INDEX "lesson_interaction_studentId_practiceMaterialId_key" ON "learning"."lesson_interaction"("studentId", "practiceMaterialId");

-- CreateIndex
CREATE INDEX "lesson_question_practiceMaterialId_createdAt_idx" ON "learning"."lesson_question"("practiceMaterialId", "createdAt");

-- AddForeignKey
ALTER TABLE "learning"."lesson_note" ADD CONSTRAINT "lesson_note_practiceMaterialId_fkey" FOREIGN KEY ("practiceMaterialId") REFERENCES "learning"."practice_material"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."lesson_interaction" ADD CONSTRAINT "lesson_interaction_practiceMaterialId_fkey" FOREIGN KEY ("practiceMaterialId") REFERENCES "learning"."practice_material"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."lesson_question" ADD CONSTRAINT "lesson_question_practiceMaterialId_fkey" FOREIGN KEY ("practiceMaterialId") REFERENCES "learning"."practice_material"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- One lesson each: a module's or a practice day's, never both or neither.
ALTER TABLE "learning"."lesson_note" ADD CONSTRAINT "lesson_note_one_lesson_check" CHECK (("videoId" IS NULL) <> ("practiceMaterialId" IS NULL));
ALTER TABLE "learning"."lesson_interaction" ADD CONSTRAINT "lesson_interaction_one_lesson_check" CHECK (("videoId" IS NULL) <> ("practiceMaterialId" IS NULL));
ALTER TABLE "learning"."lesson_question" ADD CONSTRAINT "lesson_question_one_lesson_check" CHECK (("videoId" IS NULL) <> ("practiceMaterialId" IS NULL));
