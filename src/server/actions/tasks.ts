"use server";

import {
  clearCompletedSchema,
  createTaskInputSchema,
  moveTaskSchema,
  reorderTaskSchema,
  restoreTaskSchema,
  setTaskStatusSchema,
  taskIdSchema,
  updateTaskInputSchema,
} from "@/lib/validation";
import type { ActionResult, TaskDTO } from "@/types/kairos";
import { prisma } from "@/server/db";
import { runAction } from "@/server/actions/helpers";
import {
  clearCompletedTasks,
  createTask,
  deleteTask,
  moveTask,
  reorderTask,
  restoreTask,
  ServiceError,
  setTaskStatus,
  updateTask,
} from "@/server/services/tasks";

/** Create a task or a subtask (Enter in the quick-add input, or the details panel). */
export async function createTaskAction(input: unknown): Promise<ActionResult<TaskDTO>> {
  return runAction(async () => {
    const values = createTaskInputSchema.parse(input);
    return createTask(values);
  });
}

/** Update any editable field of a task, including its category and parent. */
export async function updateTaskAction(input: unknown): Promise<ActionResult<TaskDTO>> {
  return runAction(async () => {
    const values = updateTaskInputSchema.parse(input);
    return updateTask(values);
  });
}

/**
 * Complete, reopen, or toggle a task.
 *
 * The checkbox uses `toggleTaskAction` so the server decides the next state,
 * which makes rapid clicking on a stale row safe.
 */
export async function setTaskStatusAction(input: unknown): Promise<ActionResult<TaskDTO>> {
  return runAction(async () => {
    const { id, status } = setTaskStatusSchema.parse(input);
    const result = await setTaskStatus(id, status);
    return result.task;
  });
}

export async function toggleTaskAction(input: unknown): Promise<ActionResult<TaskDTO>> {
  return runAction(async () => {
    const { id } = taskIdSchema.parse(input);
    const current = await prisma.task.findUnique({
      where: { id },
      select: { status: true },
    });
    if (!current) throw new ServiceError("Task not found.");
    const result = await setTaskStatus(id, current.status === "DONE" ? "TODO" : "DONE");
    return result.task;
  });
}

/** Delete a task (and its subtasks). Returns a snapshot so the UI can undo. */
export async function deleteTaskAction(input: unknown): Promise<ActionResult<TaskDTO>> {
  return runAction(async () => {
    const { id } = taskIdSchema.parse(input);
    return deleteTask(id);
  });
}

/** Recreate a deleted task with its subtasks and labels. */
export async function undoDeleteTaskAction(input: unknown): Promise<ActionResult<TaskDTO>> {
  return runAction(async () => {
    const values = restoreTaskSchema.parse(input);
    return restoreTask(values);
  });
}

/** Reorder a task inside its sibling group, optionally changing its planned day. */
export async function reorderTaskAction(input: unknown): Promise<ActionResult<undefined>> {
  return runAction(async () => {
    const values = reorderTaskSchema.parse(input);
    await reorderTask({
      id: values.id,
      parentId: values.parentId ?? null,
      scheduledDate: values.scheduledDate,
      targetIndex: values.targetIndex,
    });
    return undefined;
  });
}

/** Move a task to another category or under/out of a parent task. */
export async function moveTaskAction(input: unknown): Promise<ActionResult<TaskDTO>> {
  return runAction(async () => {
    const values = moveTaskSchema.parse(input);
    return moveTask({
      id: values.id,
      parentId: values.parentId !== undefined ? values.parentId : undefined,
      categoryId: values.categoryId !== undefined ? values.categoryId : undefined,
    });
  });
}

/** Delete every completed task in the current scope. */
export async function clearCompletedAction(
  input: unknown,
): Promise<ActionResult<{ count: number }>> {
  return runAction(async () => {
    const { scope } = clearCompletedSchema.parse(input);
    return clearCompletedTasks(scope);
  });
}
