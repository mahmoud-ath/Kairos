/**
 * The task service — **one public entrance**.
 *
 * Callers import from `@/server/services/tasks` and nothing else. Inside, the
 * work is split by the kind of operation rather than by size:
 *
 * - `query.ts`  — reads (tasks, summaries, the id/parent/title index)
 * - `write.ts`  — materialising a task: create and restore
 * - `edit.ts`   — changing or removing an existing task
 * - `status.ts` — completion toggles and clearing completed work (these write
 *                 history and cascade to subtasks)
 * - `tree.ts`   — moves between parents, categories and days; reordering
 * - `shared.ts` — internal helpers used by more than one of the above
 *
 * The split does not change behaviour: this file re-exports exactly the names the
 * single-module version exported, so no call site had to change. Keeping the
 * entrance stable is what lets the modules be reshaped later without a
 * repository-wide edit.
 */

export { getTask, listTaskSummaries, listTasks, loadTaskLinks } from "./query";
export { deleteTask, updateTask } from "./edit";
export { clearCompletedTasks, setSubtaskStatus, setTaskStatus } from "./status";
export { moveTask, reorderTask } from "./tree";
export { createTask, restoreTask } from "./write";
