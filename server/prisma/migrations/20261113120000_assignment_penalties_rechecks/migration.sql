-- Assignment results, resubmission penalties and rechecks.
--
-- * An assignment's results are published by staff (`resultsPublishedAt`).
--   Until then a marked hand-in's score and feedback stay hidden from its
--   student, who may resubmit — each resubmission after the first hand-in
--   costing marks and XP (utils/assignmentPenalties.ts). After it,
--   resubmitting closes and a recheck may be asked for instead.
-- * Every change to a hand-in's marks besides the mentor's own mark is kept in
--   `submission_mark_adjustment` (append-only, unique per event), and summed
--   on the hand-in as `markAdjustment`.
-- * Rechecks live in `assignment_recheck`, with the mark before and after.
-- * XP taken back for resubmitting is a negative row in the XP ledger, under
--   its own source.

-- CreateEnum
CREATE TYPE "learning"."MarkAdjustmentKind" AS ENUM ('RESUBMIT_PENALTY', 'RECHECK_FEE', 'RECHECK_REFUND', 'RECHECK_PENALTY');

-- CreateEnum
CREATE TYPE "learning"."RecheckStatus" AS ENUM ('PENDING', 'VALID', 'INVALID');

-- AlterEnum
ALTER TYPE "learning"."XpSource" ADD VALUE 'ASSIGNMENT_RESUBMIT_PENALTY';

-- AlterTable
ALTER TABLE "learning"."assignment" ADD COLUMN     "resultsPublishedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "learning"."assignment_submission" ADD COLUMN     "attempts" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "markAdjustment" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "recheckOpen" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "xpDeducted" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "learning"."submission_mark_adjustment" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "kind" "learning"."MarkAdjustmentKind" NOT NULL,
    "marks" INTEGER NOT NULL,
    "refId" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "submission_mark_adjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning"."assignment_recheck" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "learning"."RecheckStatus" NOT NULL DEFAULT 'PENDING',
    "scoreBefore" INTEGER NOT NULL,
    "scoreAfter" INTEGER,
    "reviewerNote" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assignment_recheck_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "submission_mark_adjustment_submissionId_createdAt_idx" ON "learning"."submission_mark_adjustment"("submissionId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "submission_mark_adjustment_submissionId_kind_refId_key" ON "learning"."submission_mark_adjustment"("submissionId", "kind", "refId");

-- CreateIndex
CREATE INDEX "assignment_recheck_submissionId_createdAt_idx" ON "learning"."assignment_recheck"("submissionId", "createdAt");

-- CreateIndex
CREATE INDEX "assignment_recheck_assignmentId_status_idx" ON "learning"."assignment_recheck"("assignmentId", "status");

-- CreateIndex
CREATE INDEX "assignment_recheck_status_idx" ON "learning"."assignment_recheck"("status");

-- AddForeignKey
ALTER TABLE "learning"."submission_mark_adjustment" ADD CONSTRAINT "submission_mark_adjustment_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "learning"."assignment_submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."assignment_recheck" ADD CONSTRAINT "assignment_recheck_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "learning"."assignment_submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."assignment_recheck" ADD CONSTRAINT "assignment_recheck_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "learning"."assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."assignment_recheck" ADD CONSTRAINT "assignment_recheck_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "learning"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."assignment_recheck" ADD CONSTRAINT "assignment_recheck_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "learning"."user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: until now a mark showed the moment it was given. Any assignment
-- that already has a marked (accepted) hand-in counts as published, as of its
-- latest mark — so no student loses sight of a score they can already see.
-- Assignments with nothing marked yet start unpublished, under the new rules.
UPDATE "learning"."assignment" AS a
SET "resultsPublishedAt" = marked."lastReviewedAt"
FROM (
    SELECT "assignmentId", MAX(COALESCE("reviewedAt", "updatedAt")) AS "lastReviewedAt"
    FROM "learning"."assignment_submission"
    WHERE "status" = 'ACCEPTED'
    GROUP BY "assignmentId"
) AS marked
WHERE a."id" = marked."assignmentId";
