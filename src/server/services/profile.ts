import "server-only";

import { scopedPrisma } from "@/server/db";

/**
 * Profile progress.
 *
 * Avatars beyond the two free ones are earned by completing work. The count
 * comes from the append-only `TaskEvent` log rather than the task table, so
 * clearing completed tasks — which deletes the rows — never takes an unlocked
 * avatar away again.
 *
 * Precisely what is counted: every `completed` event, recorded when a task
 * **or** a subtask is ticked off by hand. Subtasks that a parent completes
 * automatically are recorded as `subtask_completed` instead, so a single
 * cascade can never inflate the number.
 */
export async function countCompletions(userId: string): Promise<number> {
  const prisma = scopedPrisma(userId);
  return prisma.taskEvent.count({ where: { action: "completed" } });
}
