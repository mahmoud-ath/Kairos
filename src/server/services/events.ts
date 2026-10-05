import "server-only";

import type { Prisma, PrismaClient } from "@prisma/client";

import { prisma } from "@/server/db";

/** Prisma client or an interactive transaction client. */
export type Db = PrismaClient | Prisma.TransactionClient;

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
    },
  });
}

/** Events newer than `since`, used to build historical activity charts. */
export async function listEventsSince(since: Date) {
  return prisma.taskEvent.findMany({
    where: { timestamp: { gte: since } },
    orderBy: { timestamp: "asc" },
    select: { id: true, taskId: true, action: true, timestamp: true, metadata: true },
  });
}
