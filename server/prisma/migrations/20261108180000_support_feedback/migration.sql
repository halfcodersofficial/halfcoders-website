-- Support feedback: after a finished turn in a support session, the student
-- rates it (how it went, 1–5) and how far it solved their problem (1–5)
-- before they can take a number again. Nullable — nothing to backfill.
--
-- And a student may take another number in the same session once their turn
-- is over, so (sessionId, studentId) is no longer unique — only indexed.

-- DropIndex
DROP INDEX "learning"."support_queue_sessionId_studentId_key";

-- AlterTable
ALTER TABLE "learning"."support_queue" ADD COLUMN     "feedbackAt" TIMESTAMP(3),
ADD COLUMN     "feedbackRating" INTEGER,
ADD COLUMN     "feedbackSolved" INTEGER;

-- CreateIndex
CREATE INDEX "support_queue_sessionId_studentId_idx" ON "learning"."support_queue"("sessionId", "studentId");
