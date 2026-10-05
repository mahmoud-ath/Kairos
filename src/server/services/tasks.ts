import "server-only";

import { dateOnlyToDate, dateToDateOnly } from "@/lib/dates";
import { computeReorderedIds, nextPosition } from "@/lib/ordering";
import {
  subtasksToComplete,
  validateParentAssignment,
  type TaskParentLink,
} from "@/lib/task-rules";
import type { TaskDTO, TaskSummary } from "@/types/kairos";
import type { CreateTaskValues, UpdateTaskValues } from "@/lib/validation";
import { prisma, type Prisma } from "@/server/db";
import { recordTaskEvent } from "@/server/services/events";
import {
  serializeTask,
  serializeTaskSummary,
  TASK_INCLUDE,
  type TaskWithRelations,
} from "@/server/serializers";

/** Error raised by the service layer; Server Actions turn it into a message. */
export class ServiceError extends Error {
  readonly fieldErrors?: Record<string, string[]>;

  constructor(message: string, fieldErrors?: Record<string, string[]>) {
    super(message);
    this.name = "ServiceError";
    this.fieldErrors = fieldErrors;
  }
}

const TASK_ORDER: Prisma.TaskOrderByWithRelationInput[] = [
  { position: "asc" },
  { id: "asc" },
];

/* -------------------------------------------------------------------------- */
/* Reads                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Every top-level task with its subtasks and labels.
 *
 * Kairos is a personal task manager, so a page loads the (small) full set and
 * groups it in the UI with the shared helpers in `src/lib/views.ts`. Statistics
 * and counters are still computed on the server, never sent from the client.
 */
export async function listTasks(): Promise<TaskDTO[]> {
  const rows = await prisma.task.findMany({
    where: { parentId: null },
    include: TASK_INCLUDE,
    orderBy: TASK_ORDER,
  });
  return rows.map(serializeTask);
}

/** Lightweight rows for counters (sidebar and progress panel). */
export async function listTaskSummaries(): Promise<TaskSummary[]> {
  const rows = await prisma.task.findMany({
    where: { parentId: null },
    select: {
      id: true,
      status: true,
      categoryId: true,
      scheduledDate: true,
      dueDate: true,
      priority: true,
      position: true,
      completedAt: true,
    },
    orderBy: TASK_ORDER,
  });
  return rows.map(serializeTaskSummary);
}

export async function getTask(id: string): Promise<TaskDTO | null> {
  const row = await prisma.task.findUnique({ where: { id }, include: TASK_INCLUDE });
  return row ? serializeTask(row) : null;
}

/** Id/parent/title triples used by the subtask rule checks. */
export async function loadTaskLinks(
  db: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<Map<string, TaskParentLink>> {
  const rows = await db.task.findMany({
    select: { id: true, parentId: true, title: true },
  });
  return new Map(rows.map((row) => [row.id, row]));
}

async function assertCategoryExists(
  db: Prisma.TransactionClient | typeof prisma,
  categoryId: string,
): Promise<void> {
  const category = await db.category.findUnique({
    where: { id: categoryId },
    select: { id: true },
  });
  if (!category) throw new ServiceError("That category no longer exists.");
}

async function assertLabelsExist(
  db: Prisma.TransactionClient | typeof prisma,
  labelIds: readonly string[],
): Promise<void> {
  if (labelIds.length === 0) return;
  const found = await db.label.count({ where: { id: { in: [...labelIds] } } });
  if (found !== labelIds.length) {
    throw new ServiceError("One of the selected labels no longer exists.");
  }
}

async function nextSiblingPosition(
  db: Prisma.TransactionClient | typeof prisma,
  parentId: string | null,
): Promise<number> {
  const rows = await db.task.findMany({
    where: { parentId },
    select: { position: true },
  });
  return nextPosition(rows.map((row) => row.position));
}

/* -------------------------------------------------------------------------- */
/* Writes                                                                     */
/* -------------------------------------------------------------------------- */

export async function createTask(values: CreateTaskValues): Promise<TaskDTO> {
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

  const labelIds = values.labelIds ?? [];
  await assertLabelsExist(prisma, labelIds);

  const position = await nextSiblingPosition(prisma, parentId);

  const created = await prisma.task.create({
    data: {
      ...(values.id ? { id: values.id } : {}),
      title: values.title,
      notes: values.notes ?? null,
      priority: values.priority ?? "NONE",
      categoryId,
      parentId,
      scheduledDate: values.scheduledDate ? dateOnlyToDate(values.scheduledDate) : null,
      dueDate: values.dueDate ? dateOnlyToDate(values.dueDate) : null,
      position,
      labels: labelIds.length
        ? { createMany: { data: labelIds.map((labelId) => ({ labelId })) } }
        : undefined,
    },
    include: TASK_INCLUDE,
  });

  await recordTaskEvent(prisma, {
    taskId: created.id,
    action: "created",
    metadata: { parentId },
  });

  return serializeTask(created);
}

export async function updateTask(values: UpdateTaskValues): Promise<TaskDTO> {
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
    if (values.priority !== undefined) {
      data.priority = values.priority;
      changed.push("priority");
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

    if (Object.keys(data).length === 0 && values.labelIds === undefined) {
      throw new ServiceError("Nothing to update.");
    }

    let updated: TaskWithRelations;
    if (Object.keys(data).length > 0) {
      updated = await tx.task.update({
        where: { id: values.id },
        data,
        include: TASK_INCLUDE,
      });
    } else {
      updated = await tx.task.findUniqueOrThrow({
        where: { id: values.id },
        include: TASK_INCLUDE,
      });
    }

    if (values.labelIds !== undefined) {
      await assertLabelsExist(tx, values.labelIds);
      await tx.taskLabel.deleteMany({ where: { taskId: values.id } });
      if (values.labelIds.length > 0) {
        await tx.taskLabel.createMany({
          data: values.labelIds.map((labelId) => ({ taskId: values.id, labelId })),
        });
      }
      changed.push("labels");
    }

    // Subtasks always follow their parent's category.
    if (categoryChangedTo !== undefined && updated.subtasks.length > 0) {
      await tx.task.updateMany({
        where: { parentId: values.id },
        data: { categoryId: categoryChangedTo },
      });
    }

    const statusChanged = values.status !== undefined && values.status !== existing.status;
    if (statusChanged && values.status === "DONE") {
      await recordTaskEvent(tx, { taskId: values.id, action: "completed", metadata: {} });
    } else if (statusChanged && values.status === "TODO") {
      await recordTaskEvent(tx, { taskId: values.id, action: "reopened" });
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
 * Complete or reopen a task.
 *
 * Completing a parent also completes its unfinished subtasks in the same
 * transaction; reopening a parent never reopens subtasks. Repeating the same
 * state is a no-op, so history cannot be inflated by clicking twice.
 */
export async function setTaskStatus(
  id: string,
  status: "TODO" | "DONE",
): Promise<{ changed: boolean; task: TaskDTO }> {
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

      await recordTaskEvent(tx, { taskId: id, action: "completed", metadata: {} });
    } else {
      await tx.task.update({ where: { id }, data: { status: "TODO", completedAt: null } });
      await recordTaskEvent(tx, { taskId: id, action: "reopened" });
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
  id: string,
  status: "TODO" | "DONE",
): Promise<{ changed: boolean; task: TaskDTO }> {
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

/**
 * Delete a task. Deleting a parent removes its subtasks (database cascade) and
 * label assignments. The deleted task is returned so the UI can offer undo.
 */
export async function deleteTask(id: string): Promise<TaskDTO> {
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

/** Recreate a previously deleted task (used by the undo action). */
export async function restoreTask(values: {
  id: string;
  title: string;
  notes?: string | null;
  status?: "TODO" | "DONE";
  priority?: "NONE" | "LOW" | "MEDIUM" | "HIGH";
  categoryId?: string | null;
  scheduledDate?: string | null;
  dueDate?: string | null;
  position?: number;
  labelIds?: string[];
  subtasks?: Array<{
    id: string;
    title: string;
    status: "TODO" | "DONE";
    position: number;
  }>;
}): Promise<TaskDTO> {
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

  const labelIds = values.labelIds ?? [];
  const validLabels = labelIds.length
    ? (
        await prisma.label.findMany({
          where: { id: { in: labelIds } },
          select: { id: true },
        })
      ).map((label) => label.id)
    : [];

  const subtasks = values.subtasks ?? [];

  const created = await prisma.$transaction(async (tx) => {
    const task = await tx.task.create({
      data: {
        id: values.id,
        title: values.title,
        notes: values.notes ?? null,
        status: values.status ?? "TODO",
        priority: values.priority ?? "NONE",
        categoryId,
        parentId: null,
        scheduledDate: values.scheduledDate ? dateOnlyToDate(values.scheduledDate) : null,
        dueDate: values.dueDate ? dateOnlyToDate(values.dueDate) : null,
        position: values.position ?? 0,
        completedAt: values.status === "DONE" ? new Date() : null,
        labels: validLabels.length
          ? { createMany: { data: validLabels.map((labelId) => ({ labelId })) } }
          : undefined,
      },
    });

    for (const subtask of subtasks) {
      await tx.task.create({
        data: {
          id: subtask.id,
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

  await recordTaskEvent(prisma, { taskId: created.id, action: "created", metadata: { restored: true } });
  return serializeTask(created);
}

/**
 * Move a task to another group: a different category, or under (or out of) a
 * parent task. Both moves are validated server-side.
 */
export async function moveTask(values: {
  id: string;
  parentId?: string | null;
  categoryId?: string | null;
}): Promise<TaskDTO> {
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
      metadata: {
        categoryId: values.categoryId ?? null,
        parentId: values.parentId ?? null,
      },
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
export async function reorderTask(values: {
  id: string;
  parentId: string | null;
  scheduledDate?: string | null;
  targetIndex: number;
}): Promise<void> {
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
      metadata: { scheduledDate: values.scheduledDate ?? null, index: values.targetIndex },
    });
  });
}

/** Delete every completed top-level task in scope, with its subtasks. */
export async function clearCompletedTasks(
  scope: { kind: "all" } | { kind: "category"; categoryId: string },
): Promise<{ count: number }> {
  const where: Prisma.TaskWhereInput = { parentId: null, status: "DONE" };
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
