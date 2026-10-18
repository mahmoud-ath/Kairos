import "server-only";

import {
  buildBackupFile,
  validateBackup,
  type BackupFile,
  type BackupSummary,
} from "@/lib/backup";
import { dateOnlyToDate } from "@/lib/dates";
import { formatHabitDays, parseHabitDays } from "@/lib/habits";
import { DEFAULT_CATEGORY_ICON, isCategoryIconName } from "@/lib/category-icons";
import { scopedPrisma } from "@/server/db";
import { ServiceError } from "@/server/services/tasks";
import { getSettings } from "@/server/services/settings";

/** Build a complete, versioned export of one user's data. */
export async function exportBackup(userId: string): Promise<BackupFile> {
  const prisma = scopedPrisma(userId);
  const [settings, categories, habits, tasks, events] = await Promise.all([
    getSettings(userId),
    prisma.category.findMany({ orderBy: { position: "asc" } }),
    prisma.habit.findMany({ orderBy: [{ position: "asc" }, { id: "asc" }] }),
    prisma.task.findMany({ orderBy: [{ position: "asc" }, { id: "asc" }] }),
    prisma.taskEvent.findMany({ orderBy: { timestamp: "asc" } }),
  ]);

  return buildBackupFile({
    settings: {
      theme: settings.theme,
      timezone: settings.timezone,
      weekStartsOn: settings.weekStartsOn,
    },
    categories,
    habits,
    tasks,
    events,
  });
}

/**
 * Replace one user's data with the contents of a backup file.
 *
 * The file is fully validated (including cross-references) before this runs, and
 * everything is written inside one transaction: if any row fails, the existing
 * data stays exactly as it was. Only the calling user's rows are touched.
 * Version 1 files are accepted; their labels and priorities are ignored because
 * Kairos no longer has them.
 */
export async function importBackup(
  userId: string,
  raw: unknown,
): Promise<{ summary: BackupSummary }> {
  const prisma = scopedPrisma(userId);
  const validation = validateBackup(raw);
  if (!validation.ok) {
    throw new ServiceError(
      `The backup could not be imported: ${validation.errors[0]}`,
      { file: validation.errors.slice(0, 10) },
    );
  }

  const { data } = validation.data;
  // Ids that exist in the file: a reference outside them is dropped rather than
  // failing the whole import (see `createTask` and the habit loop below).
  const categoryIds = new Set(data.categories.map((category) => category.id));
  const habitIds = new Set((data.habits ?? []).map((habit) => habit.id));

  // Earliest generated instance per habit, used to infer a habit's start day for
  // a file written before habits recorded one.
  const earliestInstance = new Map<string, string>();
  for (const task of data.tasks) {
    if (!task.habitId || !task.habitDate) continue;
    const current = earliestInstance.get(task.habitId);
    if (!current || task.habitDate < current) {
      earliestInstance.set(task.habitId, task.habitDate);
    }
  }
  const fallbackStart = new Date().toISOString().slice(0, 10);

  await prisma.$transaction(
    async (tx) => {
      // Wipe current data (children first).
      await tx.taskEvent.deleteMany();
      await tx.task.deleteMany();
      await tx.habit.deleteMany();
      await tx.category.deleteMany();

      for (const category of data.categories) {
        await tx.category.create({
          data: {
            id: category.id,
            userId,
            name: category.name,
            color: category.color,
            icon:
              category.icon && isCategoryIconName(category.icon)
                ? category.icon
                : DEFAULT_CATEGORY_ICON,
            position: category.position,
          },
        });
      }

      // Habits before tasks: a generated task references its habit.
      for (const habit of data.habits ?? []) {
        await tx.habit.create({
          data: {
            id: habit.id,
            userId,
            title: habit.title,
            notes: habit.notes ?? null,
            categoryId: categoryIds.has(habit.categoryId ?? "")
              ? (habit.categoryId ?? null)
              : null,
            days: formatHabitDays(parseHabitDays(habit.days)),
            position: habit.position ?? 0,
            paused: habit.paused ?? false,
            startDate: dateOnlyToDate(
              habit.startDate ??
                earliestInstance.get(habit.id) ??
                habit.createdAt?.slice(0, 10) ??
                fallbackStart,
            ),
          },
        });
      }

      const parents = data.tasks.filter((task) => !task.parentId);
      const children = data.tasks.filter((task) => task.parentId);
      const parentById = new Map(data.tasks.map((task) => [task.id, task]));

      const createTask = async (
        task: (typeof data.tasks)[number],
        categoryIdOverride?: string | null,
      ) => {
        const categoryId =
          categoryIdOverride !== undefined ? categoryIdOverride : (task.categoryId ?? null);
        // A link to a habit that is not in the file is dropped, so an older or
        // hand-edited backup imports as ordinary tasks instead of failing.
        const habitId = task.habitId && habitIds.has(task.habitId) ? task.habitId : null;
        const habitDate = habitId
          ? (task.habitDate ?? task.scheduledDate ?? null)
          : null;
        await tx.task.create({
          data: {
            id: task.id,
            userId,
            title: task.title,
            notes: task.notes ?? null,
            status: task.status,
            categoryId,
            parentId: task.parentId ?? null,
            scheduledDate: task.scheduledDate ? dateOnlyToDate(task.scheduledDate) : null,
            dueDate: task.dueDate ? dateOnlyToDate(task.dueDate) : null,
            position: task.position,
            habitId,
            habitDate: habitDate ? dateOnlyToDate(habitDate) : null,
            completedAt:
              task.status === "DONE"
                ? new Date(task.completedAt ?? task.updatedAt ?? new Date().toISOString())
                : null,
          },
        });
      };

      // Parents first: subtasks reference them through a foreign key.
      for (const task of parents) await createTask(task);

      for (const task of children) {
        const parent = task.parentId ? parentById.get(task.parentId) : undefined;
        // Subtasks always inherit their parent's category.
        await createTask(task, parent?.categoryId ?? task.categoryId ?? null);
      }

      const taskIds = new Set(data.tasks.map((task) => task.id));
      for (const event of data.events ?? []) {
        await tx.taskEvent.create({
          data: {
            id: event.id,
            userId,
            taskId: event.taskId && taskIds.has(event.taskId) ? event.taskId : null,
            action: event.action,
            timestamp: new Date(event.timestamp),
            metadata: event.metadata ?? null,
          },
        });
      }

      await tx.settings.upsert({
        where: { userId },
        update: {
          theme: data.settings.theme,
          timezone: data.settings.timezone,
          weekStartsOn: data.settings.weekStartsOn,
        },
        create: {
          userId,
          theme: data.settings.theme,
          timezone: data.settings.timezone,
          weekStartsOn: data.settings.weekStartsOn,
        },
      });
    },
    { timeout: 120_000, maxWait: 15_000 },
  );

  return { summary: validation.summary };
}

/** Delete one user's data and start over with default settings. */
export async function resetAllData(userId: string): Promise<void> {
  const prisma = scopedPrisma(userId);
  await prisma.$transaction(async (tx) => {
    await tx.taskEvent.deleteMany();
    await tx.task.deleteMany();
    await tx.habit.deleteMany();
    await tx.category.deleteMany();
    // Devices go too: "start over" must not leave a phone receiving a reminder
    // about a workspace that has been emptied. A backup file never carries them,
    // so an import deliberately leaves them alone.
    await tx.pushSubscription.deleteMany();
    await tx.settings.deleteMany();
  });
  await getSettings(userId); // recreate this user's row with defaults
}
