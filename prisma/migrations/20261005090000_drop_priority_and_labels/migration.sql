-- DropIndex
DROP INDEX "Label_name_key";

-- DropIndex
DROP INDEX "TaskLabel_labelId_idx";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Label";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "TaskLabel";
PRAGMA foreign_keys=on;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Task" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'TODO',
    "categoryId" TEXT,
    "parentId" TEXT,
    "scheduledDate" DATETIME,
    "dueDate" DATETIME,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "completedAt" DATETIME,
    CONSTRAINT "Task_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Task_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Task" ("categoryId", "completedAt", "createdAt", "dueDate", "id", "notes", "parentId", "position", "scheduledDate", "status", "title", "updatedAt") SELECT "categoryId", "completedAt", "createdAt", "dueDate", "id", "notes", "parentId", "position", "scheduledDate", "status", "title", "updatedAt" FROM "Task";
DROP TABLE "Task";
ALTER TABLE "new_Task" RENAME TO "Task";
CREATE INDEX "Task_parentId_position_idx" ON "Task"("parentId", "position");
CREATE INDEX "Task_categoryId_parentId_idx" ON "Task"("categoryId", "parentId");
CREATE INDEX "Task_status_idx" ON "Task"("status");
CREATE INDEX "Task_scheduledDate_idx" ON "Task"("scheduledDate");
CREATE INDEX "Task_dueDate_idx" ON "Task"("dueDate");
CREATE INDEX "Task_completedAt_idx" ON "Task"("completedAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

