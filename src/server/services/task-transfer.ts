import "server-only";

import { CATEGORY_COLORS } from "@/lib/constants";
import { DEFAULT_CATEGORY_ICON } from "@/lib/category-icons";
import { dateOnlyToDate, dateToDateOnly } from "@/lib/dates";
import {
  buildTaskTransferFile,
  validateTaskTransfer,
  type TaskTransferFile,
  type TaskTransferSummary,
} from "@/lib/task-transfer";
import type { TaskStatus } from "@/types/kairos";
import { scopedPrisma } from "@/server/db";
import { ServiceError } from "@/server/errors";
import { serializeTransferSubtask, serializeTransferTask } from "@/server/serializers";
import { TASK_ORDER } from "@/server/services/tasks/shared";

/**
 * Task-only export and import.
 *
 * The full backup (settings → Backup & data) replaces a whole workspace; these
 * two are the narrower pair the top bar offers: a readable file of tasks and
 * subtasks that can be **merged** into another workspace. Nothing is deleted and
 * no id from the file is reused, so the same file can be imported twice without
 * a collision.
 *
 * Categories travel by *name*: a name that already exists here is reused (case
 * insensitively), an unknown one is created, and a task without a category stays
 * uncategorized. Generated habit instances are never exported — they belong to a
 * habit, not to the task list.
 */

/** Everything in the task list, as a transfer file. */
export async function exportTasks(userId: string): Promise<TaskTransferFile> {
  const prisma = scopedPrisma(userId);
  const [categories, tasks] = await Promise.all([
    prisma.category.findMany({ orderBy: [{ position: "asc" }, { name: "asc" }] }),
    prisma.task.findMany({
      where: { parentId: null, habitId: null },
      include: { subtasks: { orderBy: [{ position: "asc" }, { id: "asc" }] } },
      orderBy: TASK_ORDER,
    }),
  ]);

  const categoryName = new Map(categories.map((category) => [category.id, category.name]));

  return buildTaskTransferFile(
    tasks.map((task) =>
      serializeTransferTask({
        title: task.title,
        notes: task.notes,
        status: task.status as TaskStatus,
        category: task.categoryId ? (categoryName.get(task.categoryId) ?? null) : null,
        scheduledDate: task.scheduledDate ? dateToDateOnly(task.scheduledDate) : null,
        dueDate: task.dueDate ? dateToDateOnly(task.dueDate) : null,
        completedAt: task.completedAt ? task.completedAt.toISOString() : null,
        subtasks: task.subtasks.map(serializeTransferSubtask),
      }),
    ),
  );
}

/**
 * Add every task in a transfer file to this workspace.
 *
 * The file is validated first and the whole import runs in one transaction, so a
 * malformed row leaves nothing half-written. Imported tasks are appended to the
 * end of the list rather than interleaved with existing ones.
 */
export async function importTasks(
  userId: string,
  raw: unknown,
): Promise<{ summary: TaskTransferSummary }> {
  const validation = validateTaskTransfer(raw);
  if (!validation.ok) {
    throw new ServiceError(`The file could not be imported: ${validation.errors[0]}`, {
      file: validation.errors.slice(0, 10),
    });
  }

  const { data, summary } = validation;
  const prisma = scopedPrisma(userId);
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    // Categories are matched by name, so importing into a workspace that already
    // has "Work" reuses it instead of creating a second, near-identical one.
    const existing = await tx.category.findMany({
      select: { id: true, name: true, position: true },
    });
    const idByName = new Map(
      existing.map((category) => [category.name.trim().toLowerCase(), category.id]),
    );
    let nextCategoryPosition =
      existing.reduce((highest, category) => Math.max(highest, category.position), -1) + 1;

    async function resolveCategory(name: string | null | undefined): Promise<string | null> {
      const trimmed = name?.trim();
      if (!trimmed) return null;
      const key = trimmed.toLowerCase();
      const existingId = idByName.get(key);
      if (existingId) return existingId;

      const created = await tx.category.create({
        data: {
          userId,
          name: trimmed,
          color: CATEGORY_COLORS[nextCategoryPosition % CATEGORY_COLORS.length],
          icon: DEFAULT_CATEGORY_ICON,
          position: nextCategoryPosition,
        },
      });
      nextCategoryPosition += 1;
      idByName.set(key, created.id);
      return created.id;
    }

    const lastTopLevel = await tx.task.findFirst({
      where: { parentId: null },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    let position = (lastTopLevel?.position ?? -1) + 1;

    for (const task of data.tasks) {
      const status = task.status ?? "TODO";
      const categoryId = await resolveCategory(task.category);

      await tx.task.create({
        data: {
          userId,
          title: task.title,
          notes: task.notes ?? null,
          status,
          categoryId,
          parentId: null,
          scheduledDate: task.scheduledDate ? dateOnlyToDate(task.scheduledDate) : null,
          dueDate: task.dueDate ? dateOnlyToDate(task.dueDate) : null,
          position: position,
          completedAt:
            status === "DONE" ? new Date(task.completedAt ?? now.toISOString()) : null,
          subtasks: {
            create: (task.subtasks ?? []).map((subtask, index) => {
              const subtaskStatus = subtask.status ?? "TODO";
              return {
                userId,
                title: subtask.title,
                status: subtaskStatus,
                position: index,
                completedAt:
                  subtaskStatus === "DONE"
                    ? new Date(subtask.completedAt ?? now.toISOString())
                    : null,
              };
            }),
          },
        },
      });
      position += 1;
    }
  });

  return { summary };
}
