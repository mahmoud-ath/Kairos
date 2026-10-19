import "server-only";

import { dateOnlyToDate, dateToDateOnly } from "@/lib/dates";
import { computeReorderedIds } from "@/lib/ordering";
import { validateParentAssignment } from "@/lib/task-rules";
import { scopedPrisma, type Prisma } from "@/server/db";
import { ServiceError } from "@/server/errors";
import { recordTaskEvent } from "@/server/services/events";
import { serializeTask, TASK_INCLUDE } from "@/server/serializers";
import { loadTaskLinks } from "@/server/services/tasks/query";
import { assertCategoryExists } from "@/server/services/tasks/shared";
import type { TaskDTO } from "@/types/kairos";

/**
 * Moving tasks between groups.
 *
 * A "group" is a parent/subtask relationship, a category, or a scheduled day.
 * Both entry points validate nesting server-side rather than trusting the drag
 * that produced the request.
 */

/**
 * Move a task to another group: a different category, or under (or out of) a
 * parent task. Both moves are validated server-side.
 */
export async function moveTask(
  userId: string,
  values: {
    id: string;
    parentId?: string | null;
    categoryId?: string | null;
    scheduledDate?: string | null;
  },
): Promise<TaskDTO> {
  const prisma = scopedPrisma(userId);
  return prisma.$transaction(async (tx) => {
    const existing = await tx.task.findUnique({
      where: { id: values.id },
      select: { id: true, parentId: true, categoryId: true, title: true },
    });
    if (!existing) throw new ServiceError("Task not found.");

    const data: Prisma.TaskUncheckedUpdateInput = {};
    let categoryForSubtasks: string | null | undefined;

    if (values.parentId !== undefined && values.parentId !== existing.parentId) {
      const links = await loadTaskLinks(tx);
      links.set(existing.id, {
        id: existing.id,
        parentId: existing.parentId,
        title: existing.title,
      });
      const check = validateParentAssignment(links, existing.id, values.parentId);
      if (!check.ok) throw new ServiceError(check.reason);

      data.parentId = values.parentId;
      if (values.parentId) {
        const parent = await tx.task.findUnique({
          where: { id: values.parentId },
          select: { categoryId: true },
        });
        data.categoryId = parent?.categoryId ?? null;
      }
    }

    if (
      values.categoryId !== undefined &&
      values.categoryId !== existing.categoryId &&
      values.parentId === undefined
    ) {
      if (existing.parentId) {
        throw new ServiceError("Subtasks inherit their parent's category.");
      }
      if (values.categoryId) await assertCategoryExists(tx, values.categoryId);
      data.categoryId = values.categoryId;
      categoryForSubtasks = values.categoryId;
    }

    if (Object.keys(data).length === 0) {
      throw new ServiceError("Nothing to move.");
    }

    const willBeSubtask =
      values.parentId !== undefined ? values.parentId !== null : existing.parentId !== null;

    // A task can also be dropped onto a day at the same time (un-nesting).
    if (values.scheduledDate !== undefined) {
      if (willBeSubtask) {
        throw new ServiceError("Subtasks do not have their own dates.");
      }
      data.scheduledDate = values.scheduledDate
        ? dateOnlyToDate(values.scheduledDate)
        : null;
    }

    await tx.task.update({ where: { id: values.id }, data });

    // Moving a parent between categories also moves its subtasks.
    if (categoryForSubtasks !== undefined) {
      await tx.task.updateMany({
        where: { parentId: values.id },
        data: { categoryId: categoryForSubtasks },
      });
    }

    await recordTaskEvent(tx, {
      taskId: values.id,
      action: "moved",
      categoryId: values.categoryId ?? null,
      parentId: values.parentId ?? null,
    });

    const fresh = await tx.task.findUniqueOrThrow({
      where: { id: values.id },
      include: TASK_INCLUDE,
    });
    return serializeTask(fresh);
  });
}

/**
 * Reorder a task inside its sibling set, optionally moving it to another
 * scheduled-date group. Positions for the whole sibling set are rewritten in
 * one transaction so the order stays consistent.
 */
export async function reorderTask(
  userId: string,
  values: {
    id: string;
    parentId: string | null;
    scheduledDate?: string | null;
    targetIndex: number;
  },
): Promise<void> {
  const prisma = scopedPrisma(userId);
  await prisma.$transaction(async (tx) => {
    const moved = await tx.task.findUnique({
      where: { id: values.id },
      select: { id: true, parentId: true },
    });
    if (!moved) throw new ServiceError("Task not found.");
    if ((moved.parentId ?? null) !== values.parentId) {
      throw new ServiceError("That task is not part of the group being reordered.");
    }

    const siblings = await tx.task.findMany({
      where: values.parentId ? { parentId: values.parentId } : { parentId: null },
      select: { id: true, position: true, scheduledDate: true },
    });

    const isSubtaskGroup = values.parentId !== null;
    const items = siblings.map((sibling) => ({
      id: sibling.id,
      position: sibling.position,
      groupKey: isSubtaskGroup
        ? ""
        : sibling.scheduledDate
          ? dateToDateOnly(sibling.scheduledDate)
          : "",
    }));

    const targetGroup = isSubtaskGroup ? "" : (values.scheduledDate ?? "");
    const orderedIds = computeReorderedIds(items, values.id, targetGroup, values.targetIndex);

    if (!isSubtaskGroup && values.scheduledDate !== undefined) {
      await tx.task.update({
        where: { id: values.id },
        data: {
          scheduledDate: values.scheduledDate ? dateOnlyToDate(values.scheduledDate) : null,
        },
      });
    }

    const currentPosition = new Map(items.map((item) => [item.id, item.position]));
    for (const [index, id] of orderedIds.entries()) {
      if (currentPosition.get(id) === index) continue;
      await tx.task.update({ where: { id }, data: { position: index } });
    }

    await recordTaskEvent(tx, {
      taskId: values.id,
      action: "moved",
      scheduledDate: values.scheduledDate ?? null,
      index: values.targetIndex,
    });
  });
}
