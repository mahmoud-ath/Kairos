import "server-only";

import { dateOnlyToDate } from "@/lib/dates";
import type { CreateTaskValues } from "@/lib/validation";
import { scopedPrisma } from "@/server/db";
import { ServiceError } from "@/server/errors";
import { recordTaskEvent } from "@/server/services/events";
import { serializeTask, TASK_INCLUDE } from "@/server/serializers";
import { assertCategoryExists, nextSiblingPosition } from "@/server/services/tasks/shared";
import type { TaskDTO } from "@/types/kairos";

/**
 * Materialising a task: the quick-add path and the undo path.
 *
 * Editing and deleting an existing task lives in `edit.ts`; changing its status
 * lives in `status.ts`; moving it between groups lives in `tree.ts`.
 */

export async function createTask(
  userId: string,
  values: CreateTaskValues,
): Promise<TaskDTO> {
  const prisma = scopedPrisma(userId);
  const parentId = values.parentId ?? null;
  let categoryId = values.categoryId ?? null;

  if (values.id) {
    const clash = await prisma.task.findUnique({
      where: { id: values.id },
      select: { id: true },
    });
    if (clash) throw new ServiceError("That task already exists.");
  }

  if (parentId) {
    // Subtasks inherit their parent's category; a client-supplied category is
    // ignored rather than trusted.
    const parent = await prisma.task.findUnique({
      where: { id: parentId },
      select: { id: true, parentId: true, categoryId: true },
    });
    if (!parent) throw new ServiceError("Parent task not found.");
    if (parent.parentId) {
      throw new ServiceError("Subtasks cannot be nested more than one level deep.");
    }
    categoryId = parent.categoryId;
  } else if (categoryId) {
    await assertCategoryExists(prisma, categoryId);
  }

  const position = await nextSiblingPosition(prisma, parentId);

  const created = await prisma.task.create({
    data: {
      ...(values.id ? { id: values.id } : {}),
      userId,
      title: values.title,
      notes: values.notes ?? null,
      categoryId,
      parentId,
      scheduledDate: values.scheduledDate ? dateOnlyToDate(values.scheduledDate) : null,
      dueDate: values.dueDate ? dateOnlyToDate(values.dueDate) : null,
      position,
    },
    include: TASK_INCLUDE,
  });

  await recordTaskEvent(prisma, {
    taskId: created.id,
    action: "created",
    parentId,
  });

  return serializeTask(created);
}

/** Recreate a previously deleted task (used by the undo action). */
export async function restoreTask(
  userId: string,
  values: {
    id: string;
    title: string;
    notes?: string | null;
    status?: "TODO" | "DONE";
    categoryId?: string | null;
    scheduledDate?: string | null;
    dueDate?: string | null;
    position?: number;
    subtasks?: Array<{
      id: string;
      title: string;
      status: "TODO" | "DONE";
      position: number;
    }>;
  },
): Promise<TaskDTO> {
  const prisma = scopedPrisma(userId);
  const existing = await prisma.task.findUnique({
    where: { id: values.id },
    select: { id: true },
  });
  if (existing) throw new ServiceError("That task already exists.");

  let categoryId = values.categoryId ?? null;
  if (categoryId) {
    const category = await prisma.category.findUnique({
      where: { id: categoryId },
      select: { id: true },
    });
    if (!category) categoryId = null; // its category was deleted in the meantime
  }

  const subtasks = values.subtasks ?? [];

  const created = await prisma.$transaction(async (tx) => {
    const task = await tx.task.create({
      data: {
        id: values.id,
        userId,
        title: values.title,
        notes: values.notes ?? null,
        status: values.status ?? "TODO",
        categoryId,
        parentId: null,
        scheduledDate: values.scheduledDate ? dateOnlyToDate(values.scheduledDate) : null,
        dueDate: values.dueDate ? dateOnlyToDate(values.dueDate) : null,
        position: values.position ?? 0,
        completedAt: values.status === "DONE" ? new Date() : null,
      },
    });

    for (const subtask of subtasks) {
      await tx.task.create({
        data: {
          id: subtask.id,
          userId,
          title: subtask.title,
          status: subtask.status,
          position: subtask.position,
          parentId: task.id,
          categoryId,
          completedAt: subtask.status === "DONE" ? new Date() : null,
        },
      });
    }

    return tx.task.findUniqueOrThrow({ where: { id: task.id }, include: TASK_INCLUDE });
  });

  await recordTaskEvent(prisma, {
    taskId: created.id,
    action: "created",
    restored: true,
  });
  return serializeTask(created);
}
