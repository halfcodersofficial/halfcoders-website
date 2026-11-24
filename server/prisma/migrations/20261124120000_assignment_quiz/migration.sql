-- An assignment can have a quiz too, the way a module does: students take it
-- after the assignment's lessons, before its brief & submission. A quiz now
-- belongs to a module or to an assignment — exactly one of the two. Every
-- existing quiz has a module, so nothing to backfill.

-- AlterTable
ALTER TABLE "learning"."quiz" ALTER COLUMN "moduleId" DROP NOT NULL,
ADD COLUMN "assignmentId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "quiz_assignmentId_key" ON "learning"."quiz"("assignmentId");

-- AddForeignKey
ALTER TABLE "learning"."quiz" ADD CONSTRAINT "quiz_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "learning"."assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- One owner, never none or both. Prisma doesn't model CHECK constraints; it
-- leaves this one alone.
ALTER TABLE "learning"."quiz" ADD CONSTRAINT "quiz_one_owner" CHECK (("moduleId" IS NULL) <> ("assignmentId" IS NULL));
