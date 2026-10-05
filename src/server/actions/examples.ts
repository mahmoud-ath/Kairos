"use server";

import type { ActionResult } from "@/types/kairos";
import { runAction } from "@/server/actions/helpers";
import { loadExampleTasks } from "@/server/services/examples";

/**
 * Explicit, user-triggered example data for the empty first-run screen.
 * Refuses to run once the workspace holds any real data.
 */
export async function loadExampleTasksAction(): Promise<
  ActionResult<{ tasks: number; categories: number }>
> {
  return runAction(async () => loadExampleTasks());
}
