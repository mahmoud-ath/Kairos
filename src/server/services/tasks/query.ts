import "server-only";

import { cache } from "react";

import type { TaskParentLink } from "@/lib/task-rules";
import type { ScopedTx } from "@/server/db";
import { scopedPrisma } from "@/server/db";
import { serializeTask, serializeTaskSummary, TASK_INCLUDE } from "@/server/serializers";
import { TASK_ORDER } from "@/server/services/tasks/shared";
import type { TaskDTO, TaskSummary } from "@/types/kairos";

/**
 * Reading tasks.
 *
 * Kairos is a personal task manager, so a page loads the (small) full set and
 * groups it in the UI with the shared helpers in `src/lib/views.ts`. Statistics
 * and counters are still computed on the server, never sent from the client.
 */

/**
 * Every top-level task with its subtasks.
 *
 * Generated habit instances are left out unless `includeHabits` is set: they
 * belong to Today alone (see `isHabitTask` in `src/lib/views.ts`).
 *
 * Memoised per request: the layout, a page and a Server Action can all ask for
 * the same list during one render, and there is no reason to read the table
 * three times. (Not across requests — a serverless instance serves different
 * accounts in sequence, see `server/context.ts`.)
 *
 * `includeHabits` is a plain boolean rather than an options object: React keys
 * its cache on the arguments themselves, and a fresh object would miss every
 * time.
 */
export const listTasks = cache(
  async (userId: string, includeHabits = false): Promise<TaskDTO[]> => {
    const prisma = scopedPrisma(userId);
    const rows = await prisma.task.findMany({
      where: { parentId: null, ...(includeHabits ? {} : { habitId: null }) },
      include: TASK_INCLUDE,
      orderBy: TASK_ORDER,
    });
    return rows.map(serializeTask);
  },
);

/**
 * Lightweight rows for counters (sidebar and progress panel).
 *
 * Habit instances are included: `buildViewCounts` is what decides that they
 * count towards Today and the Habits badge and towards nothing else. Memoised
 * per request, like `listTasks`.
 */
export const listTaskSummaries = cache(async (userId: string): Promise<TaskSummary[]> => {
  const prisma = scopedPrisma(userId);
  const rows = await prisma.task.findMany({
    where: { parentId: null },
    select: {
      id: true,
      status: true,
      categoryId: true,
      scheduledDate: true,
      dueDate: true,
      position: true,
      completedAt: true,
      habitId: true,
    },
    orderBy: TASK_ORDER,
  });
  return rows.map(serializeTaskSummary);
});

export async function getTask(userId: string, id: string): Promise<TaskDTO | null> {
  const prisma = scopedPrisma(userId);
  const row = await prisma.task.findUnique({ where: { id }, include: TASK_INCLUDE });
  return row ? serializeTask(row) : null;
}

/**
 * Id/parent/title triples used by the subtask rule checks.
 *
 * Takes a client rather than an owner id because callers need it inside a
 * transaction.
 */
export async function loadTaskLinks(db: ScopedTx): Promise<Map<string, TaskParentLink>> {
  const rows = await db.task.findMany({
    select: { id: true, parentId: true, title: true },
  });
  return new Map(rows.map((row) => [row.id, row]));
}
