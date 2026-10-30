-- Reward courses: a course an admin gives alongside a main course a student
-- has (BonusCourse), each student's copy recorded as a BONUS course grant.

-- AlterEnum
ALTER TYPE "learning"."GrantSource" ADD VALUE 'BONUS';

-- AlterTable
ALTER TABLE "learning"."course_grant" ADD COLUMN     "bonusId" TEXT;

-- CreateTable
CREATE TABLE "learning"."bonus_course" (
    "id" TEXT NOT NULL,
    "mainCourseId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "forEveryone" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bonus_course_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bonus_course_courseId_idx" ON "learning"."bonus_course"("courseId");

-- CreateIndex
CREATE UNIQUE INDEX "bonus_course_mainCourseId_courseId_key" ON "learning"."bonus_course"("mainCourseId", "courseId");

-- CreateIndex
CREATE UNIQUE INDEX "course_grant_bonusId_studentId_courseId_key" ON "learning"."course_grant"("bonusId", "studentId", "courseId");

-- AddForeignKey
ALTER TABLE "learning"."bonus_course" ADD CONSTRAINT "bonus_course_mainCourseId_fkey" FOREIGN KEY ("mainCourseId") REFERENCES "learning"."course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."bonus_course" ADD CONSTRAINT "bonus_course_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "learning"."course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."course_grant" ADD CONSTRAINT "course_grant_bonusId_fkey" FOREIGN KEY ("bonusId") REFERENCES "learning"."bonus_course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
