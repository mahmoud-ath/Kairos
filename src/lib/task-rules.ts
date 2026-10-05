/**
 * Subtask rules, expressed as pure predicates so they can be unit tested and
 * reused by both the server (authoritative) and the UI (to disable invalid
 * options).
 *
 * Rules:
 *  - a subtask belongs to exactly one parent task
 *  - nesting is limited to one visible level (a subtask cannot have children)
 *  - cycles are rejected
 *  - subtasks inherit their parent's category
 */

export type TaskParentLink = { id: string; parentId: string | null; title?: string };

export type RuleResult = { ok: true } | { ok: false; reason: string };

/** Walk from a task up to the root, returning the ancestor ids. */
export function ancestorIds(
  byId: ReadonlyMap<string, TaskParentLink>,
  taskId: string,
): string[] {
  const ancestors: string[] = [];
  const seen = new Set<string>([taskId]);
  let current = byId.get(taskId);
  let guard = 0;
  while (current?.parentId && guard < 100) {
    if (seen.has(current.parentId)) break; // defensive: never loop forever
    seen.add(current.parentId);
    ancestors.push(current.parentId);
    current = byId.get(current.parentId);
    guard += 1;
  }
  return ancestors;
}

/** True when `candidateAncestorId` is somewhere above `taskId`. */
export function isAncestorOf(
  byId: ReadonlyMap<string, TaskParentLink>,
  candidateAncestorId: string,
  taskId: string,
): boolean {
  return ancestorIds(byId, taskId).includes(candidateAncestorId);
}

/**
 * Validate assigning `taskId` under `parentId` (`null` detaches the task).
 * `byId` must contain every task involved.
 */
export function validateParentAssignment(
  byId: ReadonlyMap<string, TaskParentLink>,
  taskId: string,
  parentId: string | null,
): RuleResult {
  if (parentId === null) return { ok: true };

  if (taskId === parentId) {
    return { ok: false, reason: "A task cannot be its own parent." };
  }

  const task = byId.get(taskId);
  if (!task) return { ok: false, reason: "Task not found." };

  const parent = byId.get(parentId);
  if (!parent) return { ok: false, reason: "Parent task not found." };

  if (parent.parentId) {
    return {
      ok: false,
      reason: "Subtasks cannot be nested more than one level deep.",
    };
  }

  if (task.parentId === parentId) {
    return { ok: true };
  }

  if (isAncestorOf(byId, taskId, parentId)) {
    return { ok: false, reason: "That move would create a cycle." };
  }

  if (isAncestorOf(byId, parentId, taskId)) {
    // The task is currently an ancestor of the target: only possible when the
    // task is a parent, which would make it a subtask of its own descendant.
    return { ok: false, reason: "That move would create a cycle." };
  }

  return { ok: true };
}

/** True when the task itself has children (it is a parent task). */
export function hasChildren(
  tasks: readonly TaskParentLink[],
  taskId: string,
): boolean {
  return tasks.some((task) => task.parentId === taskId);
}

/**
 * True when the task can receive subtasks: it must be a top-level task.
 * (Existing children do not block it — a parent task stays a parent.)
 */
export function canAcceptSubtasks(
  byId: ReadonlyMap<string, TaskParentLink>,
  taskId: string,
): boolean {
  const task = byId.get(taskId);
  if (!task) return false;
  return task.parentId === null;
}

export type SubtaskProgress = { done: number; total: number; percent: number };

/** Completion progress for a task's subtasks, e.g. `2/4`. */
export function subtaskProgress(
  subtasks: readonly { status: string }[],
): SubtaskProgress {
  const total = subtasks.length;
  const done = subtasks.filter((subtask) => subtask.status === "DONE").length;
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);
  return { done, total, percent };
}

/**
 * Which subtasks a parent completion should also complete. Already-completed
 * subtasks are excluded so we do not write duplicate completion events.
 */
export function subtasksToComplete(
  subtasks: readonly { id: string; status: string }[],
): string[] {
  return subtasks.filter((subtask) => subtask.status !== "DONE").map((s) => s.id);
}

/** Reopening a parent never reopens its subtasks. */
export function subtasksToReopen(): string[] {
  return [];
}

/** Only top-level tasks belong in the date-grouped views. */
export function isTopLevelTask(task: { parentId: string | null }): boolean {
  return task.parentId === null;
}
