import "server-only";

import { addDays, dateOnlyToDate } from "@/lib/dates";
import {
  buildActivitySeries,
  buildScopeCounts,
  type ActivityPoint,
  type ScopeCounts,
} from "@/lib/stats";
import { lastNDays } from "@/lib/dates";
import { selectScopedTasks, type ViewScope } from "@/lib/views";
import { listEventsSince } from "@/server/services/events";
import { listTasks } from "@/server/services/tasks";
import { listCategories } from "@/server/services/taxonomy";
import type { TaskDTO } from "@/types/kairos";

export type CategoryBreakdown = {
  id: string | null;
  name: string;
  color: string;
  total: number;
  completed: number;
  remaining: number;
  percentage: number;
};

export type StatisticsPayload = {
  scope: ViewScope;
  windowDays: number;
  today: string;
  /** Current state of the parent tasks in scope. */
  parents: ScopeCounts;
  /** Current state of their subtasks (counted separately, never merged). */
  subtasks: ScopeCounts;
  /** Historical completion/reopen activity, newest last. */
  activity: ActivityPoint[];
  categoryBreakdown: CategoryBreakdown[];
  /** Completion activity per category over the selected window. */
  activityTotals: { completed: number; reopened: number };
};

const UNCATEGORIZED = { id: null, name: "Uncategorized", color: "#94a3b8" };

/**
 * Statistics for one scope.
 *
 * "Current" numbers come from the task table; "historical" numbers come from
 * immutable `TaskEvent` rows, so a task that is reopened today still counts as
 * completed on the day it was actually finished.
 */
export async function getStatistics(options: {
  scope: ViewScope;
  today: string;
  timeZone: string;
  windowDays: number;
}): Promise<StatisticsPayload> {
  const { scope, today, timeZone, windowDays } = options;

  const [tasks, categories] = await Promise.all([listTasks(), listCategories()]);

  const scoped = selectScopedTasks(scope, tasks, today);
  const subtasks = scoped.flatMap((task) =>
    task.subtasks.map((subtask) => ({ status: subtask.status })),
  );

  const days = lastNDays(today, windowDays);
  // Fetch a little more than the window so timezone offsets cannot clip a day.
  const since = dateOnlyToDate(addDays(today, -(windowDays + 2)));
  const events = await listEventsSince(since);
  const activity = buildActivitySeries(events, days, timeZone);

  const categoryBreakdown = buildCategoryBreakdown(tasks, categories);

  return {
    scope,
    windowDays,
    today,
    parents: buildScopeCounts(scoped),
    subtasks: buildScopeCounts(subtasks),
    activity,
    categoryBreakdown,
    activityTotals: {
      completed: activity.reduce((total, point) => total + point.completed, 0),
      reopened: activity.reduce((total, point) => total + point.reopened, 0),
    },
  };
}

function buildCategoryBreakdown(
  tasks: readonly TaskDTO[],
  categories: readonly { id: string; name: string; color: string }[],
): CategoryBreakdown[] {
  const rows = new Map<string, CategoryBreakdown>();

  for (const category of categories) {
    rows.set(category.id, {
      id: category.id,
      name: category.name,
      color: category.color,
      total: 0,
      completed: 0,
      remaining: 0,
      percentage: 0,
    });
  }

  for (const task of tasks) {
    const key = task.categoryId ?? "none";
    let row = rows.get(key);
    if (!row) {
      row = { ...UNCATEGORIZED, total: 0, completed: 0, remaining: 0, percentage: 0 };
      rows.set(key, row);
    }
    row.total += 1;
    if (task.status === "DONE") row.completed += 1;
    else row.remaining += 1;
  }

  return [...rows.values()]
    .filter((row) => row.total > 0)
    .map((row) => ({
      ...row,
      percentage: row.total === 0 ? 0 : Math.round((row.completed / row.total) * 100),
    }))
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
}
