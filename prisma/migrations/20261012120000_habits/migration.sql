-- ===========================================================================
-- Habits.
--
-- A habit is the recipe; each day it is due, a Task is generated from it and
-- appears in Today. Progress is never stored on the habit — it is derived from
-- the generated tasks and the append-only TaskEvent log — so this migration is
-- purely additive: one new table, two nullable columns on Task and their
-- indexes. Existing rows get habitId/habitDate = NULL and are untouched.
-- ===========================================================================

-- CreateTable
CREATE TABLE "Habit" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "categoryId" TEXT,
    "days" TEXT NOT NULL DEFAULT '0,1,2,3,4,5,6',
    "position" INTEGER NOT NULL DEFAULT 0,
    "paused" BOOLEAN NOT NULL DEFAULT false,
    "startDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Habit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Habit_userId_position_idx" ON "Habit"("userId", "position");

-- CreateIndex
CREATE INDEX "Habit_userId_paused_idx" ON "Habit"("userId", "paused");

-- AddForeignKey
ALTER TABLE "Habit" ADD CONSTRAINT "Habit_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "Task" ADD COLUMN "habitId" TEXT,
ADD COLUMN "habitDate" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Task_userId_habitId_habitDate_idx" ON "Task"("userId", "habitId", "habitDate");

-- CreateIndex
-- One generated instance per habit per day. Postgres treats NULLs as distinct,
-- so ordinary tasks (habitId = NULL) are unaffected by this constraint.
CREATE UNIQUE INDEX "Task_habitId_habitDate_key" ON "Task"("habitId", "habitDate");

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_habitId_fkey" FOREIGN KEY ("habitId") REFERENCES "Habit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
