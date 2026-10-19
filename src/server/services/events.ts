import "server-only";

import type { Prisma } from "@prisma/client";

import type { TaskEventAction, TaskEventDetails } from "@/lib/events";
import { metadataFromDetails } from "@/lib/events";
import type { ScopedTx } from "@/server/db";
import { scopedPrisma } from "@/server/db";

/** A user-scoped Prisma client, or a transaction opened from one. */
export type Db = ScopedTx;

export type { TaskEventAction };

/**
 * Append-only progress history.
 *
 * Events are what make Kairos' statistics historical rather than "current state
 * only": after a task is reopened or edited, the fact that it was completed on a
 * given day is still recorded here. Callers only write an event when something
 * actually changed, so repeated checkbox toggles cannot inflate history.
 *
 * The payload's meaning is defined in `lib/events.ts`; readers parse it through
 * `parseTaskEventMetadata` rather than reading raw keys.
 */

export async function recordTaskEvent(db: Db, event: TaskEventDetails): Promise<void> {
  // The payload's shape is defined in `lib/events.ts`; this only serialises it.
  // `taskId` is always present inside the JSON too: TaskEvent's `taskId` column is
  // nulled when a task is deleted, but the daily activity charts still need to
  // count that task once per day.
  const metadata = metadataFromDetails(event);

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
