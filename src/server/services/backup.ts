import "server-only";

import type { Prisma } from "@prisma/client";

import {
  buildBackupFile,
  validateBackup,
  type BackupFile,
  type BackupScope,
  type BackupSummary,
} from "@/lib/backup";
import { dateOnlyToDate } from "@/lib/dates";
import { formatHabitDays, parseHabitDays } from "@/lib/habits";
import { DEFAULT_CATEGORY_ICON, isCategoryIconName } from "@/lib/category-icons";
import { scopedPrisma } from "@/server/db";
import { ServiceError } from "@/server/errors";
import { getSettings } from "@/server/services/settings";

/** Which slice of the workspace to write out. */
export type BackupExportScope = "all" | "open" | "category";

export type BackupExportOptions = {
  /** Defaults to `"all"` — the whole workspace. */
  scope?: BackupExportScope;
  /** Required when `scope` is `"category"`. */
  categoryId?: string | null;
  /** Include the task history. Defaults to true. */
  includeHistory?: boolean;
};

/**
 * Build a versioned export of one user's data.
 *
 * A partial export (open tasks only, or one category) is still a *reading* of the
 * workspace: it keeps every cross-reference intact by filtering children and
 * history against the tasks that are actually in the file.
 */
export async function exportBackup(
  userId: string,
  options: BackupExportOptions = {},
): Promise<BackupFile> {
  const scope = options.scope ?? "all";
  const prisma = scopedPrisma(userId);
  const [settings, categoryRows, habitRows, taskRows, eventRows] = await Promise.all([
    getSettings(userId),
    prisma.category.findMany({ orderBy: { position: "asc" } }),
    prisma.habit.findMany({ orderBy: [{ position: "asc" }, { id: "asc" }] }),
    prisma.task.findMany({ orderBy: [{ position: "asc" }, { id: "asc" }] }),
    prisma.taskEvent.findMany({ orderBy: { timestamp: "asc" } }),
  ]);

  const categoryById = new Map(categoryRows.map((category) => [category.id, category]));
  const categoryId = options.categoryId ?? null;
  if (scope === "category" && (!categoryId || !categoryById.has(categoryId))) {
    throw new ServiceError("That category no longer exists. Pick another one.");
  }

  let categories = categoryRows;
  let habits = habitRows;
  let tasks = taskRows;

  if (scope === "category") {
    const parentIds = new Set(
      taskRows
        .filter((task) => task.parentId === null && task.categoryId === categoryId)
        .map((task) => task.id),
    );
    // A subtask always belongs with its parent, whatever its own column says.
    tasks = taskRows.filter((task) =>
      task.parentId ? parentIds.has(task.parentId) : task.categoryId === categoryId,
    );
    categories = categoryRows.filter((category) => category.id === categoryId);
    habits = habitRows.filter((habit) => habit.categoryId === categoryId);
  } else if (scope === "open") {
    const openParents = new Set(
      taskRows
        .filter((task) => task.parentId === null && task.status === "TODO")
        .map((task) => task.id),
    );
    tasks = taskRows.filter((task) =>
      task.status === "TODO" && (task.parentId ? openParents.has(task.parentId) : true),
    );
    const usedCategories = new Set(
      tasks
        .map((task) => task.categoryId)
        .filter((id): id is string => Boolean(id)),
    );
    categories = categoryRows.filter((category) => usedCategories.has(category.id));
    // An open-task export carries no generated habit instances, so it needs no
    // habit recipes either.
    habits = [];
  }

  const taskIds = new Set(tasks.map((task) => task.id));
  const events =
    options.includeHistory === false
      ? []
      : scope === "all"
        ? eventRows
        : eventRows.filter((event) => event.taskId !== null && taskIds.has(event.taskId));

  const exportScope: BackupScope | undefined =
    scope === "all"
      ? undefined
      : scope === "open"
        ? { kind: "open", label: "Open tasks" }
        : {
            kind: "category",
            categoryId,
            label: categoryById.get(categoryId as string)?.name,
          };

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
    scope: exportScope,
  });
}

/**
 * Add the contents of a backup file to one user's workspace.
 *
 * Importing never deletes anything: the file is validated (including every
 * cross-reference) and then written inside one transaction, creating what is
 * missing and updating what it already knows. A full backup restores a wiped
 * workspace exactly as before, and a partial export (one category, or only open
 * tasks) adds its rows to what is already there — so a mistake in choosing what
 * to export can never destroy data. Only the calling user's rows are touched.
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
  const partial = data.scope !== undefined && data.scope.kind !== "all";
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
      // Categories are matched by id first, then by name: a partial file may
      // carry a category from another workspace under a different id, and names
      // are unique per account. The map keeps every task reference pointing at
      // the row that actually exists here.
      const categoryIdMap = new Map<string, string>();
      for (const category of data.categories) {
        const icon =
          category.icon && isCategoryIconName(category.icon)
            ? category.icon
            : DEFAULT_CATEGORY_ICON;
        const existing =
          (await tx.category.findUnique({ where: { id: category.id } })) ??
          (await tx.category.findFirst({ where: { name: category.name } }));
        if (existing) {
          await tx.category.update({
            where: { id: existing.id },
            data: { color: category.color, icon },
          });
          categoryIdMap.set(category.id, existing.id);
        } else {
          await tx.category.create({
            data: {
              id: category.id,
              userId,
              name: category.name,
              color: category.color,
              icon,
              position: category.position,
            },
          });
          categoryIdMap.set(category.id, category.id);
        }
      }
      const mappedCategory = (id: string | null | undefined): string | null =>
        id ? (categoryIdMap.get(id) ?? null) : null;

      // Habits before tasks: a generated task references its habit. An upsert
      // keeps an existing habit's row — and therefore its history — intact.
      for (const habit of data.habits ?? []) {
        const values = {
          title: habit.title,
          notes: habit.notes ?? null,
          categoryId: mappedCategory(habit.categoryId),
          days: formatHabitDays(parseHabitDays(habit.days)),
          position: habit.position ?? 0,
          paused: habit.paused ?? false,
          startDate: dateOnlyToDate(
            habit.startDate ??
              earliestInstance.get(habit.id) ??
              habit.createdAt?.slice(0, 10) ??
              fallbackStart,
          ),
        };
        await tx.habit.upsert({
          where: { id: habit.id },
          create: { id: habit.id, userId, ...values },
          update: values,
        });
      }

      const parents = data.tasks.filter((task) => !task.parentId);
      const children = data.tasks.filter((task) => task.parentId);
      const parentById = new Map(data.tasks.map((task) => [task.id, task]));

      const taskValues = (
        task: (typeof data.tasks)[number],
        categoryIdOverride?: string | null,
      ) => {
        const categoryId =
          categoryIdOverride !== undefined ? categoryIdOverride : mappedCategory(task.categoryId);
        // A link to a habit that is not in the file is dropped, so an older or
        // hand-edited backup imports as ordinary tasks instead of failing.
        const habitId = task.habitId && habitIds.has(task.habitId) ? task.habitId : null;
        const habitDate = habitId ? (task.habitDate ?? task.scheduledDate ?? null) : null;
        return {
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
        };
      };

      const importTask = async (
        task: (typeof data.tasks)[number],
        categoryIdOverride?: string | null,
      ) => {
        const values = taskValues(task, categoryIdOverride);
        // Upsert, never delete: re-importing the same file is a no-op, and an
        // import into a used workspace adds to it instead of replacing it.
        await tx.task.upsert({
          where: { id: task.id },
          create: { id: task.id, userId, ...values },
          update: values,
        });
      };

      // Parents first: subtasks reference them through a foreign key.
      for (const task of parents) await importTask(task);

      for (const task of children) {
        const parent = task.parentId ? parentById.get(task.parentId) : undefined;
        // Subtasks always inherit their parent's category.
        const inherited = parent
          ? mappedCategory(parent.categoryId)
          : mappedCategory(task.categoryId);
        await importTask(task, inherited);
      }

      // History is append-only, so importing twice must not double it: skip an
      // event whose id is already here, or whose task/action/instant matches one
      // that is (a copy exported without ids).
      const existingEvents = await tx.taskEvent.findMany({
        select: { id: true, taskId: true, action: true, timestamp: true },
      });
      const knownIds = new Set(existingEvents.map((event) => event.id));
      const knownEvents = new Set(
        existingEvents.map(
          (event) => `${event.taskId ?? ""}|${event.action}|${event.timestamp.toISOString()}`,
        ),
      );
      const freshEvents: Prisma.TaskEventCreateManyInput[] = [];
      const taskIds = new Set(data.tasks.map((task) => task.id));
      for (const event of data.events ?? []) {
        if (event.id && knownIds.has(event.id)) continue;
        const timestamp = new Date(event.timestamp);
        const signature = `${event.taskId ?? ""}|${event.action}|${timestamp.toISOString()}`;
        if (knownEvents.has(signature)) continue;
        knownEvents.add(signature);
        freshEvents.push({
          id: event.id,
          userId,
          taskId: event.taskId && taskIds.has(event.taskId) ? event.taskId : null,
          action: event.action,
          timestamp,
          metadata: event.metadata ?? null,
        });
      }
      if (freshEvents.length > 0) await tx.taskEvent.createMany({ data: freshEvents });

      // Settings only move with a full backup: adding a category to this account
      // must not change its theme, timezone or week start.
      if (!partial) {
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
      }
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
