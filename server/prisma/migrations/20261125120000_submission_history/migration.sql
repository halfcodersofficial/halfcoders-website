-- A hand-in's history: every version the student sent, and every marking.
--
-- * `submission_version`: each hand-in exactly as sent — the first, each
--   resubmission, and work sent again for a recheck. The live row
--   (`assignment_submission`) keeps only the latest.
-- * `submission_review`: each marking as given — decision, mark, feedback
--   and rubric lines. The live row keeps only the latest.
--
-- Earlier versions weren't kept before this, so each submission starts with
-- the one it holds now. Earlier markings come from the staff change history
-- (decision and mark), with the latest one's feedback and rubric from the
-- submission itself.

-- CreateEnum
CREATE TYPE "learning"."SubmissionVersionKind" AS ENUM ('FIRST', 'REQUESTED', 'VOLUNTARY', 'RECHECK');

-- CreateTable
CREATE TABLE "learning"."submission_version" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "attempt" INTEGER NOT NULL,
    "kind" "learning"."SubmissionVersionKind" NOT NULL,
    "content" TEXT,
    "submissionUrl" TEXT,
    "fileUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "submission_version_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning"."submission_review" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "reviewerId" TEXT,
    "status" "learning"."SubmissionStatus" NOT NULL,
    "score" INTEGER,
    "feedback" TEXT,
    "rubric" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "submission_review_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "submission_version_submissionId_submittedAt_idx" ON "learning"."submission_version"("submissionId", "submittedAt");

-- CreateIndex
CREATE INDEX "submission_review_submissionId_createdAt_idx" ON "learning"."submission_review"("submissionId", "createdAt");

-- AddForeignKey
ALTER TABLE "learning"."submission_version" ADD CONSTRAINT "submission_version_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "learning"."assignment_submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."submission_review" ADD CONSTRAINT "submission_review_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "learning"."assignment_submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."submission_review" ADD CONSTRAINT "submission_review_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "learning"."user"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Backfill: the version each submission holds now. Its kind from what's on
-- record: a resubmission paid for (marks or XP) was the student's own choice;
-- any other was asked for by the mentor.
INSERT INTO "learning"."submission_version" ("id", "submissionId", "attempt", "kind", "content", "submissionUrl", "fileUrls", "submittedAt")
SELECT
    gen_random_uuid()::text,
    s."id",
    s."attempts",
    (CASE
        WHEN s."attempts" = 1 THEN 'FIRST'
        WHEN EXISTS (
            SELECT 1 FROM "learning"."submission_mark_adjustment" a
            WHERE a."submissionId" = s."id" AND a."kind" = 'RESUBMIT_PENALTY' AND a."refId" = s."attempts"::text
        ) OR EXISTS (
            SELECT 1 FROM "learning"."xp_transaction" x
            WHERE x."source" = 'ASSIGNMENT_RESUBMIT_PENALTY' AND x."refId" = s."id" || ':' || s."attempts"::text
        ) THEN 'VOLUNTARY'
        ELSE 'REQUESTED'
    END)::"learning"."SubmissionVersionKind",
    s."content",
    s."submissionUrl",
    s."fileUrls",
    s."submittedAt"
FROM "learning"."assignment_submission" s;

-- Backfill: each marking the staff change history kept — the decision, and the mark when it was typed in.
INSERT INTO "learning"."submission_review" ("id", "submissionId", "reviewerId", "status", "score", "createdAt")
SELECT
    gen_random_uuid()::text,
    s."id",
    a."actorId",
    (a."detail"->>'status')::"learning"."SubmissionStatus",
    CASE WHEN jsonb_typeof(a."detail"->'score') = 'number' THEN (a."detail"->>'score')::integer END,
    a."createdAt"
FROM "learning"."staff_activity" a
JOIN "learning"."assignment_submission" s ON s."id" = a."entityId"
WHERE a."action" = 'submission.review'
  AND a."detail"->>'status' IN ('ACCEPTED', 'NEEDS_REVISION', 'REJECTED');

-- A marked submission the change history has nothing on: its current marking, as one review.
INSERT INTO "learning"."submission_review" ("id", "submissionId", "reviewerId", "status", "score", "createdAt")
SELECT gen_random_uuid()::text, s."id", s."reviewedById", s."status", s."score", s."reviewedAt"
FROM "learning"."assignment_submission" s
WHERE s."reviewedAt" IS NOT NULL
  AND s."status" IN ('ACCEPTED', 'NEEDS_REVISION', 'REJECTED')
  AND NOT EXISTS (SELECT 1 FROM "learning"."submission_review" r WHERE r."submissionId" = s."id");

-- The latest marking still sits on the submission (unless it was handed in
-- again since): its feedback, its rubric lines, and its mark when the
-- history didn't keep one.
UPDATE "learning"."submission_review" r
SET
    "feedback" = s."feedback",
    "score" = COALESCE(r."score", s."score"),
    "rubric" = (
        SELECT jsonb_agg(
            jsonb_build_object('title', c."title", 'points', rs."points", 'maxPoints', c."maxPoints", 'comment', rs."comment")
            ORDER BY c."order"
        )
        FROM "learning"."rubric_score" rs
        JOIN "learning"."rubric_criterion" c ON c."id" = rs."criterionId"
        WHERE rs."submissionId" = s."id"
    )
FROM "learning"."assignment_submission" s
WHERE r."submissionId" = s."id"
  AND s."reviewedAt" IS NOT NULL
  AND r."createdAt" = (SELECT max(r2."createdAt") FROM "learning"."submission_review" r2 WHERE r2."submissionId" = s."id");
