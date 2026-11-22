import "server-only";

import {
  categoryKey,
  UNCATEGORIZED_COLOR,
  UNCATEGORIZED_ID,
} from "@/lib/categories";
import { UNCATEGORIZED_LABEL } from "@/lib/constants";
import {
  buildActivitySeries,
  buildScopeCounts,
  bucketActivityByWeek,
  type ActivityPoint,
  type ActivityRange,
  type ScopeCounts,
} from "@/lib/stats";
import { addDays, dateOnlyToDate, startOfWeek } from "@/lib/dates";
import { selectScopedTasks, type ViewScope } from "@/lib/views";
import type { RequestContext } from "@/server/context";
import { listEventsSince } from "@/server/services/events";
import { listTasks } from "@/server/services/tasks";
import { listCategories } from "@/server/services/taxonomy";
import type { TaskDTO } from "@/types/kairos";

export type CategoryBreakdown = {
  /** A real category id, or `UNCATEGORIZED_ID` for tasks with no category. */
  id: string;
  name: string;
  color: string;
  total: number;
  completed: number;
  remaining: number;
  percentage: number;
};

export type StatisticsPayload = {
  scope: ViewScope;
  /** The resolved window this payload describes. */
  range: ActivityRange;
  /** Number of days in `range` (kept for the compact progress panel). */
  windowDays: number;
  today: string;
  /** Current state of the parent tasks in scope. */
  parents: ScopeCounts;
  /** Current state of their subtasks (counted separately, never merged). */
  subtasks: ScopeCounts;
  /** Historical completion/reopen activity, newest last. Weekly when long. */
  activity: ActivityPoint[];
  /**
   * Completions since the configured week start, always from the daily series so
   * a weekly-bucketed chart cannot make this figure wrong.
   */
  completedThisWeek: number;
  categoryBreakdown: CategoryBreakdown[];
  /** Completion activity per category over the selected window. */
  activityTotals: { completed: number; reopened: number };
};

const UNCATEGORIZED = {
  id: UNCATEGORIZED_ID,
  name: UNCATEGORIZED_LABEL,
  color: UNCATEGORIZED_COLOR,
};

/**
 * Statistics for one scope.
 *
 * "Current" numbers come from the task table; "historical" numbers come from
 * immutable `TaskEvent` rows, so a task that is reopened today still counts as
 * completed on the day it was actually finished.
 */
export async function getStatistics(
  ctx: RequestContext,
  options: {
    scope: ViewScope;
    range: ActivityRange;
    /**
     * Tasks already loaded for this request. The workspace reads them anyway, so
     * passing them in avoids a second identical table scan.
     */
    tasks?: readonly TaskDTO[];
  },
): Promise<StatisticsPayload> {
  const { userId, today, timeZone } = ctx;
  const { scope, range } = options;

  const [tasks, categories] = await Promise.all([
    options.tasks ? Promise.resolve(options.tasks) : listTasks(userId),
    listCategories(userId),
  ]);

  const scoped = selectScopedTasks(scope, tasks, today);
  const subtasks = scoped.flatMap((task) =>
    task.subtasks.map((subtask) => ({ status: subtask.status })),
  );

  // Fetch a little more than the window so timezone offsets cannot clip a day.
  const since = dateOnlyToDate(addDays(range.from, -2));
  // Only completion history is charted; reading every event type would grow
  // without bound as the workspace is used, and is discarded immediately.
  const events = await listEventsSince(userId, since, ["completed", "reopened"]);
  const dailyActivity = buildActivitySeries(events, range.days, timeZone);
  const activity = range.weekly ? bucketActivityByWeek(dailyActivity) : dailyActivity;
  const weekStart = startOfWeek(today, ctx.settings.weekStartsOn);

  const categoryBreakdown = buildCategoryBreakdown(tasks, categories);

  return {
    scope,
    range,
    windowDays: range.windowDays,
    today,
    parents: buildScopeCounts(scoped),
    subtasks: buildScopeCounts(subtasks),
    activity,
    completedThisWeek: dailyActivity
      .filter((point) => point.date >= weekStart)
      .reduce((total, point) => total + point.completed, 0),
    categoryBreakdown,
    activityTotals: {
      completed: dailyActivity.reduce((total, point) => total + point.completed, 0),
      reopened: dailyActivity.reduce((total, point) => total + point.reopened, 0),
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
    // The same key the filter and the sidebar counters use, so "no category"
    // means one thing across the whole app.
    const key = categoryKey(task.categoryId);
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
