"use client";

import type { TaskSection } from "@/lib/views";
import type { TaskDTO } from "@/types/kairos";

/**
 * Helpers that translate a finished drag into "which task moved where".
 *
 * Drag identifiers used in the DOM:
 *  - a task or subtask row uses its own id
 *  - a date/section placeholder uses `section:<key>`
 *  - a subtask list placeholder uses `subtasks:<parentId>`
 *  - a sidebar category uses `category:<id>`
 */
export const SECTION_PREFIX = "section:";
export const SUBTASK_LIST_PREFIX = "subtasks:";
export const CATEGORY_PREFIX = "category:";

export type DragItem = {
  task: TaskDTO;
  /** `null` when the dragged item is a top-level task. */
  parentId: string | null;
};

export function findDragItem(tasks: readonly TaskDTO[], id: string): DragItem | null {
  for (const task of tasks) {
    if (task.id === id) return { task, parentId: null };
    const subtask = task.subtasks.find((candidate) => candidate.id === id);
    if (subtask) {
      return {
        task: { ...task, subtasks: task.subtasks },
        parentId: task.id,
      };
    }
  }
  return null;
}

export function sectionOf<T extends TaskDTO>(
  sections: readonly TaskSection<T>[],
  taskId: string,
): TaskSection<T> | null {
  return (
    sections.find((section) => section.tasks.some((task) => task.id === taskId)) ?? null
  );
}

export function sectionByKey<T extends TaskDTO>(
  sections: readonly TaskSection<T>[],
  key: string,
): TaskSection<T> | null {
  return sections.find((section) => section.key === key) ?? null;
}

/**
 * Which scheduled date a drop into this section implies.
 * `undefined` means "keep the current date" (pure reordering).
 */
export function scheduledDateForSection(
  section: TaskSection<TaskDTO>,
): string | null | undefined {
  switch (section.kind) {
    case "today":
    case "upcoming":
      return section.date;
    case "unscheduled":
      return null;
    default:
      return undefined;
  }
}

/** Order of the target section after inserting `movedId` at `targetIndex`. */
export function reorderedIdsFor(
  section: TaskSection<TaskDTO>,
  movedId: string,
  targetIndex: number,
): string[] {
  const ids = section.tasks.filter((task) => task.id !== movedId).map((task) => task.id);
  const clamped = Math.max(0, Math.min(targetIndex, ids.length));
  ids.splice(clamped, 0, movedId);
  return ids;
}

/** Where a drop landed inside a list of ids. */
export function dropIndex(
  list: readonly { id: string }[],
  overId: string | null,
  fallback: number,
): number {
  if (!overId) return fallback;
  const index = list.findIndex((item) => item.id === overId);
  return index === -1 ? fallback : index;
}
