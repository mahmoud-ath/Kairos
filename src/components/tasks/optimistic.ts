"use client";

import type { SubtaskDTO, TaskDTO } from "@/types/kairos";

/**
 * Optimistic state for the task list.
 *
 * Every action describes the *result* the user should see immediately. React's
 * `useOptimistic` discards these changes when the transition finishes, so a
 * failed Server Action rolls back automatically — the UI then shows the error.
 */
export type OptimisticAction =
  | { type: "add"; task: TaskDTO }
  | { type: "patch"; id: string; patch: Partial<TaskDTO> }
  | {
      type: "patchSubtask";
      parentId: string;
      subtaskId: string;
      patch: Partial<SubtaskDTO>;
    }
  | { type: "remove"; id: string }
  | { type: "addSubtask"; parentId: string; subtask: SubtaskDTO }
  | { type: "removeSubtask"; parentId: string; subtaskId: string }
  | {
      type: "reorder";
      orderedIds: string[];
      movedId: string;
      scheduledDate?: string | null;
    }
  | { type: "reorderSubtasks"; parentId: string; orderedIds: string[] };

export function optimisticReducer(
  tasks: readonly TaskDTO[],
  action: OptimisticAction,
): TaskDTO[] {
  switch (action.type) {
    case "add":
      return [...tasks, action.task];

    case "patch":
      return tasks.map((task) =>
        task.id === action.id ? { ...task, ...action.patch } : task,
      );

    case "patchSubtask":
      return tasks.map((task) =>
        task.id === action.parentId
          ? {
              ...task,
              subtasks: task.subtasks.map((subtask) =>
                subtask.id === action.subtaskId ? { ...subtask, ...action.patch } : subtask,
              ),
            }
          : task,
      );

    case "remove":
      return tasks.filter((task) => task.id !== action.id);

    case "addSubtask":
      return tasks.map((task) =>
        task.id === action.parentId
          ? { ...task, subtasks: [...task.subtasks, action.subtask] }
          : task,
      );

    case "removeSubtask":
      return tasks.map((task) =>
        task.id === action.parentId
          ? {
              ...task,
              subtasks: task.subtasks.filter(
                (subtask) => subtask.id !== action.subtaskId,
              ),
            }
          : task,
      );

    case "reorder": {
      const positions = new Map(action.orderedIds.map((id, index) => [id, index]));
      return tasks.map((task) => {
        const next: TaskDTO = { ...task };
        const position = positions.get(task.id);
        if (position !== undefined) next.position = position;
        if (task.id === action.movedId && action.scheduledDate !== undefined) {
          next.scheduledDate = action.scheduledDate;
        }
        return next;
      });
    }

    case "reorderSubtasks": {
      const positions = new Map(action.orderedIds.map((id, index) => [id, index]));
      return tasks.map((task) =>
        task.id === action.parentId
          ? {
              ...task,
              subtasks: [...task.subtasks]
                .map((subtask) => {
                  const position = positions.get(subtask.id);
                  return position === undefined ? subtask : { ...subtask, position };
                })
                .sort((a, b) => a.position - b.position),
            }
          : task,
      );
    }

    default:
      return [...tasks];
  }
}

/**
 * Id for a task that is created optimistically.
 *
 * The client picks the id and sends it with the create request, so anything the
 * user does to the new row before the server answers (ticking a subtask, opening
 * the details panel) still refers to a real record. The shape mirrors a cuid so
 * ids look uniform in the database.
 */
export function clientTaskId(): string {
  const random = Math.random().toString(36).slice(2, 10);
  return `c${Date.now().toString(36)}${random}`;
}

/** True while a task only exists in the browser (before the server answered). */
export function isClientGeneratedId(id: string): boolean {
  return id.startsWith("c") && !id.includes("-");
}
