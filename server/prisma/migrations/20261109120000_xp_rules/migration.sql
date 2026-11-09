-- XP under the new rules, for everyone. Data only — no schema change.
--
-- Only two things earn XP now (utils/platformSettings.ts, `XpRules`):
--   * finishing a module: 2 XP within 24 hours of its clock starting, else 1;
--   * handing an assignment in by its deadline: 3 XP (late earns nothing).
-- Lessons, quizzes, practice days, support sessions, milestones, whole
-- courses and assignment marks earn nothing any more.
--
-- Every award made under the old rules is replaced: the ledger and the
-- per-course totals are rebuilt from what students have actually done, so the
-- leaderboard is fair from day one. The rules below match the live ones in
-- progress.service.ts (`moduleClockStarts`) and assignment.service.ts.

-- Start over.
DELETE FROM "learning"."xp_transaction";
DELETE FROM "learning"."course_xp";
-- The stored amounts were the old per-event ones; the new defaults apply.
DELETE FROM "learning"."platform_setting" WHERE "key" = 'xp.rules';

-- Modules. A module's 24 hours start at its release on a bootcamp course; on
-- a self-paced course — or a bootcamp module with no release time — at the
-- student's first lesson in it.
WITH "first_lesson" AS (
    SELECT "enrollmentId", "moduleId", MIN("createdAt") AS "startedAt"
    FROM "learning"."video_progress"
    GROUP BY "enrollmentId", "moduleId"
)
INSERT INTO "learning"."xp_transaction" ("id", "studentId", "courseId", "source", "points", "refId", "createdAt")
SELECT
    gen_random_uuid()::text,
    mp."studentId",
    m."courseId",
    'MODULE_COMPLETE'::"learning"."XpSource",
    CASE
        WHEN mp."completedAt" <= COALESCE(
            CASE WHEN c."courseType" = 'BOOTCAMP' THEN m."publishedAt" END,
            fl."startedAt"
        ) + INTERVAL '24 hours' THEN 2
        ELSE 1
    END,
    mp."moduleId",
    mp."completedAt"
FROM "learning"."module_progress" mp
JOIN "learning"."course_module" m ON m."id" = mp."moduleId"
JOIN "learning"."course" c ON c."id" = m."courseId"
LEFT JOIN "first_lesson" fl ON fl."enrollmentId" = mp."enrollmentId" AND fl."moduleId" = mp."moduleId"
WHERE mp."isCompleted" AND mp."completedAt" IS NOT NULL;

-- Assignments. A first hand-in after the deadline is capped by its late
-- window (`maxScore`), and that cap is kept through every resubmission — so
-- no cap means the first hand-in was on time.
INSERT INTO "learning"."xp_transaction" ("id", "studentId", "courseId", "source", "points", "refId", "createdAt")
SELECT
    gen_random_uuid()::text,
    s."studentId",
    a."courseId",
    'ASSIGNMENT_SUBMIT'::"learning"."XpSource",
    3,
    s."assignmentId",
    s."submittedAt"
FROM "learning"."assignment_submission" s
JOIN "learning"."assignment" a ON a."id" = s."assignmentId"
WHERE s."maxScore" IS NULL;

-- Each student's total per course, from the rebuilt ledger.
INSERT INTO "learning"."course_xp" ("id", "studentId", "courseId", "totalXp", "updatedAt")
SELECT gen_random_uuid()::text, "studentId", "courseId", SUM("points")::integer, CURRENT_TIMESTAMP
FROM "learning"."xp_transaction"
WHERE "courseId" IS NOT NULL
GROUP BY "studentId", "courseId";
