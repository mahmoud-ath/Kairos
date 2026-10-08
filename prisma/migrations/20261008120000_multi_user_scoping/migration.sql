-- ===========================================================================
-- Multi-user: every row belongs to one owner.
--
-- DESTRUCTIVE BY DESIGN. This drops and recreates the four tables, because
-- Kairos is pre-launch: the production database is empty and local development
-- data is throw-away. There is no sensible owner to backfill the old rows with,
-- and inventing one would silently hand somebody else's data to the first
-- account that signs up.
--
-- After applying this, run `bun run db:reset` locally, and sign in once on the
-- deployment to create fresh data.
-- ===========================================================================

DROP TABLE IF EXISTS "TaskEvent";
DROP TABLE IF EXISTS "Task";
DROP TABLE IF EXISTS "Category";
DROP TABLE IF EXISTS "Settings";

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'TODO',
    "categoryId" TEXT,
    "parentId" TEXT,
    "scheduledDate" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#f97316',
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "taskId" TEXT,
    "action" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" TEXT,

    CONSTRAINT "TaskEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Settings" (
    "userId" TEXT NOT NULL,
    "theme" TEXT NOT NULL DEFAULT 'system',
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "weekStartsOn" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Settings_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE INDEX "Task_userId_parentId_position_idx" ON "Task"("userId", "parentId", "position");

-- CreateIndex
CREATE INDEX "Task_userId_categoryId_parentId_idx" ON "Task"("userId", "categoryId", "parentId");

-- CreateIndex
CREATE INDEX "Task_userId_status_idx" ON "Task"("userId", "status");

-- CreateIndex
CREATE INDEX "Task_userId_scheduledDate_idx" ON "Task"("userId", "scheduledDate");

-- CreateIndex
CREATE INDEX "Task_userId_dueDate_idx" ON "Task"("userId", "dueDate");

-- CreateIndex
CREATE INDEX "Task_userId_completedAt_idx" ON "Task"("userId", "completedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Category_userId_name_key" ON "Category"("userId", "name");

-- CreateIndex
CREATE INDEX "Category_userId_position_idx" ON "Category"("userId", "position");

-- CreateIndex
CREATE INDEX "TaskEvent_userId_timestamp_idx" ON "TaskEvent"("userId", "timestamp");

-- CreateIndex
CREATE INDEX "TaskEvent_userId_action_timestamp_idx" ON "TaskEvent"("userId", "action", "timestamp");

-- CreateIndex
CREATE INDEX "TaskEvent_userId_taskId_action_idx" ON "TaskEvent"("userId", "taskId", "action");

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskEvent" ADD CONSTRAINT "TaskEvent_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;
