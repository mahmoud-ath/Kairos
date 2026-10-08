import "server-only";

import type { Prisma } from "@prisma/client";

import type { ScopedTx } from "@/server/db";
import { scopedPrisma } from "@/server/db";

/** A user-scoped Prisma client, or a transaction opened from one. */
export type Db = ScopedTx;

/**
 * Append-only progress history.
 *
 * Events are what make Kairos' statistics historical rather than "current state
 * only": after a task is reopened or edited, the fact that it was completed on a
 * given day is still recorded here. Callers only write an event when something
 * actually changed, so repeated checkbox toggles cannot inflate history.
 */
export type TaskEventAction =
  | "created"
  | "updated"
  | "completed"
  | "reopened"
  | "deleted"
  | "moved"
  | "subtask_completed"
  | "subtask_reopened";

export async function recordTaskEvent(
  db: Db,
  event: {
    taskId?: string | null;
    action: TaskEventAction;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  // The originating task id is always kept inside the metadata too: TaskEvent's
  // `taskId` is nulled when a task is deleted, but the daily activity charts
  // still need to count that task once per day.
  const metadata = { ...(event.metadata ?? {}), taskId: event.taskId ?? null };

  await db.taskEvent.create({
    data: {
      taskId: event.taskId ?? null,
      action: event.action,
      metadata: JSON.stringify(metadata),
      // No `userId` here on purpose: the client the caller passed in is already
      // scoped, so the owner is stamped for us. The assertion records that this
      // omission is deliberate rather than a forgotten field.
    } as Prisma.TaskEventUncheckedCreateInput,
  });
}

/** Events newer than `since` for one owner, used to build activity charts. */
export async function listEventsSince(userId: string, since: Date) {
  const prisma = scopedPrisma(userId);
  return prisma.taskEvent.findMany({
    where: { timestamp: { gte: since } },
    orderBy: { timestamp: "asc" },
    select: { id: true, taskId: true, action: true, timestamp: true, metadata: true },
  });
}
