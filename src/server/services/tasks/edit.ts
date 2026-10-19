import "server-only";

import { dateOnlyToDate } from "@/lib/dates";
import { subtasksToComplete, validateParentAssignment } from "@/lib/task-rules";
import type { UpdateTaskValues } from "@/lib/validation";
import { scopedPrisma, type Prisma } from "@/server/db";
import { ServiceError } from "@/server/errors";
import { recordTaskEvent } from "@/server/services/events";
import { serializeTask, TASK_INCLUDE, type TaskWithRelations } from "@/server/serializers";
import { loadTaskLinks } from "@/server/services/tasks/query";
import { assertCategoryExists, habitCompletionMetadata } from "@/server/services/tasks/shared";
import type { TaskDTO } from "@/types/kairos";

/** Changing or removing a task that already exists. */

export async function updateTask(
  userId: string,
  values: UpdateTaskValues,
): Promise<TaskDTO> {
  const prisma = scopedPrisma(userId);
  return prisma.$transaction(async (tx) => {
    const existing = await tx.task.findUnique({
      where: { id: values.id },
      include: { subtasks: { select: { id: true } } },
    });
    if (!existing) throw new ServiceError("Task not found.");

    const isSubtask = existing.parentId !== null;
    const data: Prisma.TaskUncheckedUpdateInput = {};
    const changed: string[] = [];
    let categoryChangedTo: string | null | undefined;

    if (values.title !== undefined) {
      data.title = values.title;
      changed.push("title");
    }
    if (values.notes !== undefined) {
      data.notes = values.notes;
      changed.push("notes");
    }
    if (values.dueDate !== undefined) {
      if (isSubtask) throw new ServiceError("Subtasks do not have their own dates.");
      data.dueDate = values.dueDate ? dateOnlyToDate(values.dueDate) : null;
      changed.push("dueDate");
    }
    if (values.scheduledDate !== undefined) {
      if (isSubtask) throw new ServiceError("Subtasks do not have their own dates.");
      data.scheduledDate = values.scheduledDate
        ? dateOnlyToDate(values.scheduledDate)
        : null;
      changed.push("scheduledDate");
    }

    // --- parent / category relationships ---------------------------------
    let newParentId = existing.parentId;
    let newCategoryId = existing.categoryId;

    if (values.parentId !== undefined && values.parentId !== existing.parentId) {
      const links = await loadTaskLinks(tx);
      links.set(existing.id, {
        id: existing.id,
        parentId: existing.parentId,
        title: existing.title,
      });
      const check = validateParentAssignment(links, existing.id, values.parentId);
      if (!check.ok) throw new ServiceError(check.reason);

      newParentId = values.parentId;
      if (newParentId) {
        const parent = await tx.task.findUnique({
          where: { id: newParentId },
          select: { categoryId: true },
        });
        newCategoryId = parent?.categoryId ?? null;
      }
      data.parentId = newParentId;
      data.categoryId = newCategoryId;
      changed.push("parentId");
    } else if (values.categoryId !== undefined && values.categoryId !== existing.categoryId) {
      if (isSubtask) {
        throw new ServiceError("Subtasks inherit their parent's category.");
      }
      if (values.categoryId) await assertCategoryExists(tx, values.categoryId);
      newCategoryId = values.categoryId;
      categoryChangedTo = values.categoryId;
      data.categoryId = newCategoryId;
      changed.push("categoryId");
    }

    if (values.status !== undefined && values.status !== existing.status) {
      if (values.status === "DONE") {
        data.status = "DONE";
        data.completedAt = new Date();
        const pending = await tx.task.findMany({
          where: { parentId: existing.id },
          select: { id: true, status: true },
        });
        const toComplete = subtasksToComplete(pending);
        if (toComplete.length > 0) {
          await tx.task.updateMany({
            where: { id: { in: toComplete } },
            data: { status: "DONE", completedAt: new Date() },
          });
          await recordTaskEvent(tx, {
            taskId: existing.id,
            action: "subtask_completed",
            metadata: { count: toComplete.length, via: "parent" },
          });
        }
      } else {
        data.status = "TODO";
        data.completedAt = null;
      }
      changed.push("status");
    }

    if (Object.keys(data).length === 0) {
      throw new ServiceError("Nothing to update.");
    }

    const updated: TaskWithRelations = await tx.task.update({
      where: { id: values.id },
      data,
      include: TASK_INCLUDE,
    });

    // Subtasks always follow their parent's category.
    if (categoryChangedTo !== undefined && updated.subtasks.length > 0) {
      await tx.task.updateMany({
        where: { parentId: values.id },
        data: { categoryId: categoryChangedTo },
      });
    }

    const statusChanged = values.status !== undefined && values.status !== existing.status;
    if (statusChanged && values.status === "DONE") {
      await recordTaskEvent(tx, {
        taskId: values.id,
        action: "completed",
        metadata: habitCompletionMetadata(existing),
      });
    } else if (statusChanged && values.status === "TODO") {
      // The habit metadata is repeated here on purpose: a reopened event is what
      // takes a day back off a habit's record, so it has to name the same day.
      await recordTaskEvent(tx, {
        taskId: values.id,
        action: "reopened",
        metadata: habitCompletionMetadata(existing),
      });
    }
    if (changed.length > 0) {
      await recordTaskEvent(tx, {
        taskId: values.id,
        action: "updated",
        metadata: { fields: changed },
      });
    }

    const fresh = await tx.task.findUniqueOrThrow({
      where: { id: values.id },
      include: TASK_INCLUDE,
    });
    return serializeTask(fresh);
  });
}

/**
 * Delete a task. Deleting a parent removes its subtasks (database cascade).
 * The deleted task is returned so the UI can offer undo.
 */
export async function deleteTask(userId: string, id: string): Promise<TaskDTO> {
  const prisma = scopedPrisma(userId);
  const task = await prisma.task.findUnique({ where: { id }, include: TASK_INCLUDE });
  if (!task) throw new ServiceError("Task not found.");
  const snapshot = serializeTask(task);

  await prisma.$transaction(async (tx) => {
    await tx.task.delete({ where: { id } });
    if (task.parentId === null) {
      await recordTaskEvent(tx, {
        taskId: null,
        action: "deleted",
        metadata: { taskId: snapshot.id, title: snapshot.title, subtasks: snapshot.subtasks.length },
      });
    }
  });

  return snapshot;
}
