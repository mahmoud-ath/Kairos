import "server-only";

import { subtasksToComplete } from "@/lib/task-rules";
import { scopedPrisma, type Prisma } from "@/server/db";
import { ServiceError } from "@/server/errors";
import { recordTaskEvent } from "@/server/services/events";
import { serializeTask, TASK_INCLUDE } from "@/server/serializers";
import { habitCompletionMetadata } from "@/server/services/tasks/shared";
import type { TaskDTO } from "@/types/kairos";

/**
 * Changing a task's completion state.
 *
 * These are separated from ordinary edits because they are the writes that
 * produce history: they cascade to subtasks, record `completed`/`reopened`
 * events, and (for habit instances) name the day the instance belonged to.
 */

/**
 * Complete or reopen a task.
 *
 * Completing a parent also completes its unfinished subtasks in the same
 * transaction; reopening a parent never reopens subtasks. Repeating the same
 * state is a no-op, so history cannot be inflated by clicking twice.
 */
export async function setTaskStatus(
  userId: string,
  id: string,
  status: "TODO" | "DONE",
): Promise<{ changed: boolean; task: TaskDTO }> {
  const prisma = scopedPrisma(userId);
  return prisma.$transaction(async (tx) => {
    const task = await tx.task.findUnique({
      where: { id },
      include: { subtasks: { select: { id: true, status: true } } },
    });
    if (!task) throw new ServiceError("Task not found.");

    if (task.status === status) {
      const fresh = await tx.task.findUniqueOrThrow({
        where: { id },
        include: TASK_INCLUDE,
      });
      return { changed: false, task: serializeTask(fresh) };
    }

    const now = new Date();
    if (status === "DONE") {
      await tx.task.update({
        where: { id },
        data: { status: "DONE", completedAt: now },
      });

      const toComplete = subtasksToComplete(task.subtasks);
      if (toComplete.length > 0) {
        await tx.task.updateMany({
          where: { id: { in: toComplete } },
          data: { status: "DONE", completedAt: now },
        });
        await recordTaskEvent(tx, {
          taskId: id,
          action: "subtask_completed",
          metadata: { count: toComplete.length, via: "parent" },
        });
      }

      await recordTaskEvent(tx, {
        taskId: id,
        action: "completed",
        metadata: habitCompletionMetadata(task),
      });
    } else {
      await tx.task.update({ where: { id }, data: { status: "TODO", completedAt: null } });
      await recordTaskEvent(tx, {
        taskId: id,
        action: "reopened",
        metadata: habitCompletionMetadata(task),
      });
    }

    const fresh = await tx.task.findUniqueOrThrow({
      where: { id },
      include: TASK_INCLUDE,
    });
    return { changed: true, task: serializeTask(fresh) };
  });
}

/** Toggle a subtask's own status (parents are never auto-completed). */
export async function setSubtaskStatus(
  userId: string,
  id: string,
  status: "TODO" | "DONE",
): Promise<{ changed: boolean; task: TaskDTO }> {
  const prisma = scopedPrisma(userId);
  const subtask = await prisma.task.findUnique({
    where: { id },
    select: { id: true, parentId: true },
  });
  if (!subtask) throw new ServiceError("Subtask not found.");

  return prisma.$transaction(async (tx) => {
    if (!subtask.parentId) {
      // Not a subtask after all — behave like a normal task toggle.
      const task = await tx.task.findUniqueOrThrow({
        where: { id },
        include: TASK_INCLUDE,
      });
      return { changed: false, task: serializeTask(task) };
    }

    const current = await tx.task.findUniqueOrThrow({
      where: { id },
      select: { status: true },
    });
    if (current.status === status) {
      const parent = await tx.task.findUniqueOrThrow({
        where: { id: subtask.parentId },
        include: TASK_INCLUDE,
      });
      return { changed: false, task: serializeTask(parent) };
    }

    await tx.task.update({
      where: { id },
      data: {
        status,
        completedAt: status === "DONE" ? new Date() : null,
      },
    });
    await recordTaskEvent(tx, {
      taskId: id,
      action: status === "DONE" ? "completed" : "reopened",
      metadata: { parentId: subtask.parentId, subtask: true },
    });

    const parent = await tx.task.findUniqueOrThrow({
      where: { id: subtask.parentId },
      include: TASK_INCLUDE,
    });
    return { changed: true, task: serializeTask(parent) };
  });
}

/** Delete every completed top-level task in scope, with its subtasks. */
export async function clearCompletedTasks(
  userId: string,
  scope: { kind: "all" } | { kind: "category"; categoryId: string },
): Promise<{ count: number }> {
  const prisma = scopedPrisma(userId);
  // Generated habit instances are left alone: they are not part of the task
  // list's Completed section, and their history is what habit progress reads.
  const where: Prisma.TaskWhereInput = { parentId: null, status: "DONE", habitId: null };
  if (scope.kind === "category") where.categoryId = scope.categoryId;

  return prisma.$transaction(async (tx) => {
    const tasks = await tx.task.findMany({
      where,
      select: { id: true, title: true, subtasks: { select: { id: true } } },
    });
    if (tasks.length === 0) return { count: 0 };

    await tx.task.deleteMany({ where });
    await recordTaskEvent(tx, {
      taskId: null,
      action: "deleted",
      metadata: { cleared: tasks.length, titles: tasks.slice(0, 10).map((t) => t.title) },
    });
    return { count: tasks.length };
  });
}
