"use server";

import type { ActionResult } from "@/types/kairos";
import { requireUserId } from "@/server/auth";
import { runAction } from "@/server/actions/helpers";
import { loadExampleTasks, removeExampleData } from "@/server/services/examples";

/**
 * Explicit, user-triggered example data for the empty first-run screen.
 * Refuses to run once the workspace holds any real data.
 */
export async function loadExampleTasksAction(): Promise<
  ActionResult<{ tasks: number; categories: number; habits: number }>
> {
  return runAction(
    async () => {
      const userId = await requireUserId();
      return loadExampleTasks(userId);
    },
    // Rewrites the workspace, so it spends the `expensive` budget, not `mutation`.
    { action: "loadExampleTasks" },
  );
}

/**
 * Delete the sample tasks, habits, categories and history again.
 *
 * Matched by title against the loader's own definitions, so anything the person
 * renamed or created themselves survives.
 */
export async function removeExampleDataAction(): Promise<
  ActionResult<{ tasks: number; habits: number; categories: number }>
> {
  return runAction(
    async () => {
      const userId = await requireUserId();
      return removeExampleData(userId);
    },
    { action: "removeExampleData" },
  );
}
