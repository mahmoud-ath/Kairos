import "server-only";

import type { Prisma } from "@prisma/client";

import { dateToDateOnly } from "@/lib/dates";
import type { TransferSubtask, TransferTask } from "@/lib/task-transfer";
import type {
  CategoryDTO,
  SubtaskDTO,
  TaskDTO,
  TaskStatus,
  TaskSummary,
} from "@/types/kairos";

/** Relations loaded for every task handed to the UI. */
export const TASK_INCLUDE = {
  subtasks: { orderBy: [{ position: "asc" }, { id: "asc" }] },
} satisfies Prisma.TaskInclude;

export type TaskWithRelations = Prisma.TaskGetPayload<{ include: typeof TASK_INCLUDE }>;

export function serializeTask(task: TaskWithRelations): TaskDTO {
  return {
    id: task.id,
    title: task.title,
    notes: task.notes,
    status: task.status as TaskStatus,
    categoryId: task.categoryId,
    parentId: task.parentId,
    scheduledDate: task.scheduledDate ? dateToDateOnly(task.scheduledDate) : null,
    dueDate: task.dueDate ? dateToDateOnly(task.dueDate) : null,
    position: task.position,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
    completedAt: task.completedAt ? task.completedAt.toISOString() : null,
    habitId: task.habitId,
    subtasks: task.subtasks.map(serializeSubtask),
  };
}

export function serializeSubtask(task: {
  id: string;
  title: string;
  status: string;
  position: number;
  completedAt: Date | null;
}): SubtaskDTO {
  return {
    id: task.id,
    title: task.title,
    status: task.status as TaskStatus,
    position: task.position,
    completedAt: task.completedAt ? task.completedAt.toISOString() : null,
  };
}

/**
 * A subtask as it travels in a transfer file.
 *
 * No id and no position: an import creates the row, and the order in the array
 * is the order it lands in (see `lib/task-transfer.ts`).
 */
export function serializeTransferSubtask(subtask: {
  title: string;
  status: string;
  completedAt: Date | null;
}): TransferSubtask {
  return {
    title: subtask.title,
    status: subtask.status as TaskStatus,
    completedAt: subtask.completedAt ? subtask.completedAt.toISOString() : null,
  };
}

/** A top-level task as it travels in a transfer file (category by *name*). */
export function serializeTransferTask(task: {
  title: string;
  notes: string | null;
  status: TaskStatus;
  category: string | null;
  scheduledDate: string | null;
  dueDate: string | null;
  completedAt: string | null;
  subtasks: TransferSubtask[];
}): TransferTask {
  return {
    title: task.title,
    notes: task.notes,
    status: task.status,
    category: task.category,
    scheduledDate: task.scheduledDate,
    dueDate: task.dueDate,
    completedAt: task.completedAt,
    subtasks: task.subtasks,
  };
}

export function serializeCategory(
  category: { id: string; name: string; color: string; icon: string; position: number },
  openTaskCount: number,
): CategoryDTO {
  return {
    id: category.id,
    name: category.name,
    color: category.color,
    icon: category.icon,
    position: category.position,
    openTaskCount,
  };
}

export function serializeTaskSummary(task: {
  id: string;
  status: string;
  categoryId: string | null;
  scheduledDate: Date | null;
  dueDate: Date | null;
  position: number;
  completedAt: Date | null;
  habitId: string | null;
}): TaskSummary {
  return {
    id: task.id,
    status: task.status as TaskStatus,
    categoryId: task.categoryId,
    scheduledDate: task.scheduledDate ? dateToDateOnly(task.scheduledDate) : null,
    dueDate: task.dueDate ? dateToDateOnly(task.dueDate) : null,
    position: task.position,
    completedAt: task.completedAt ? task.completedAt.toISOString() : null,
    habitId: task.habitId,
  };
}
