-- Practice days get lessons: a video, a written text or a link — the same
-- three a module's lessons are — worked through before the student marks the
-- day done. Built like an assignment's lessons (`assignment_material`). A new
-- table only; nothing to backfill.

-- CreateTable
CREATE TABLE "learning"."practice_material" (
    "id" TEXT NOT NULL,
    "practiceDayId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "type" "learning"."LessonType" NOT NULL DEFAULT 'VIDEO',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "youtubeUrl" TEXT,
    "youtubeVideoId" TEXT,
    "content" TEXT,
    "resourceUrl" TEXT,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "practice_material_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "practice_material_courseId_idx" ON "learning"."practice_material"("courseId");

-- CreateIndex
CREATE UNIQUE INDEX "practice_material_practiceDayId_order_key" ON "learning"."practice_material"("practiceDayId", "order");

-- AddForeignKey
ALTER TABLE "learning"."practice_material" ADD CONSTRAINT "practice_material_practiceDayId_fkey" FOREIGN KEY ("practiceDayId") REFERENCES "learning"."practice_day"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."practice_material" ADD CONSTRAINT "practice_material_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "learning"."course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
