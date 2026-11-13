"use server";

import { z } from "zod";

import { TASK_TRANSFER_MAX_BYTES, type TaskTransferSummary } from "@/lib/task-transfer";
import type { ActionResult } from "@/types/kairos";
import { requireUserId } from "@/server/auth";
import { runAction } from "@/server/actions/helpers";
import { ServiceError } from "@/server/errors";
import { importTasks } from "@/server/services/task-transfer";

const importInputSchema = z.object({
  json: z
    .string()
    .min(2, "The file is empty.")
    .max(TASK_TRANSFER_MAX_BYTES, "That file is too large."),
});

/**
 * Add the tasks in a JSON transfer file to this workspace.
 *
 * A merge, never a replacement: existing tasks are left alone and the imported
 * ones are appended. The file is validated on the server as well as in the
 * browser, so a hand-edited file cannot write anything the schema rejects.
 */
export async function importTasksAction(
  input: unknown,
): Promise<ActionResult<{ summary: TaskTransferSummary }>> {
  return runAction(
    async () => {
      const userId = await requireUserId();
      const { json } = importInputSchema.parse(input);
      let parsed: unknown;
      try {
        parsed = JSON.parse(json);
      } catch {
        throw new ServiceError("The selected file is not valid JSON.");
      }
      return importTasks(userId, parsed);
    },
    { action: "importTasks" },
  );
}
