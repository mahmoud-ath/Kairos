import "server-only";

import { dateToDateOnly } from "@/lib/dates";
import { habitCompletionMetadata as habitDayMetadata } from "@/lib/events";
import { nextPosition } from "@/lib/ordering";
import type { Prisma, ScopedTx } from "@/server/db";
import { ServiceError } from "@/server/errors";

/**
 * Pieces shared by more than one task module.
 *
 * This file is **internal**: `services/tasks/index.ts` is the public entrance.
 * Anything here is free to change as long as the entrance keeps its shape.
 */

/** The order tasks are read in: explicit position, then id for stability. */
export const TASK_ORDER: Prisma.TaskOrderByWithRelationInput[] = [
  { position: "asc" },
  { id: "asc" },
];

/**
 * Extra metadata written when a habit's generated task is completed.
 *
 * It names the habit and the day the instance belonged to, so the habit's
 * progress can be read back from the append-only event log even after the task
 * row itself is gone — which is what makes "the habit is done" a view over
 * history rather than a value that has to be maintained.
 *
 * The field names live in `lib/events.ts`, so the writer and the habit history
 * reader cannot drift apart.
 */
export function habitCompletionMetadata(task: {
  habitId: string | null;
  habitDate: Date | null;
}): Record<string, unknown> {
  return habitDayMetadata({
    habitId: task.habitId,
    habitDate: task.habitDate ? dateToDateOnly(task.habitDate) : null,
  });
}

export async function assertCategoryExists(
  db: ScopedTx,
  categoryId: string,
): Promise<void> {
  const category = await db.category.findUnique({
    where: { id: categoryId },
    select: { id: true },
  });
  if (!category) throw new ServiceError("That category no longer exists.");
}

export async function nextSiblingPosition(
  db: ScopedTx,
  parentId: string | null,
): Promise<number> {
  const rows = await db.task.findMany({
    where: { parentId },
    select: { position: true },
  });
  return nextPosition(rows.map((row) => row.position));
}
