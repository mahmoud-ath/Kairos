import "server-only";

import type { Prisma } from "@prisma/client";

import { dateToDateOnly } from "@/lib/dates";
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

export function serializeCategory(
  category: { id: string; name: string; color: string; position: number },
  openTaskCount: number,
): CategoryDTO {
  return {
    id: category.id,
    name: category.name,
    color: category.color,
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
}): TaskSummary {
  return {
    id: task.id,
    status: task.status as TaskStatus,
    categoryId: task.categoryId,
    scheduledDate: task.scheduledDate ? dateToDateOnly(task.scheduledDate) : null,
    dueDate: task.dueDate ? dateToDateOnly(task.dueDate) : null,
    position: task.position,
    completedAt: task.completedAt ? task.completedAt.toISOString() : null,
  };
}
