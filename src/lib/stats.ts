/**
 * Statistics helpers (pure).
 *
 * Kairos keeps two distinct ideas apart:
 *  - *current* state: how many parent tasks are done vs. remaining right now
 *    (derived from the task table)
 *  - *historical* activity: how much work was completed on each day, derived
 *    from immutable `TaskEvent` rows so it survives reopens and edits.
 */

import { dateOnlyInTimeZone, lastNDays } from "@/lib/dates";

export type TaskEventLike = {
  id?: string;
  taskId: string | null;
  action: string;
  timestamp: string | Date;
  metadata?: string | null;
};

export type ActivityPoint = {
  /** `YYYY-MM-DD` in the user's timezone. */
  date: string;
  completed: number;
  reopened: number;
};

export type ScopeCounts = {
  total: number;
  completed: number;
  remaining: number;
  /** Completion percentage for the scope, 0–100. */
  percentage: number;
};

export function completionPercentage(completed: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((completed / total) * 100);
}

/** Current-state counts for a set of tasks (parents or subtasks). */
export function buildScopeCounts(items: readonly { status: string }[]): ScopeCounts {
  const completed = items.filter((item) => item.status === "DONE").length;
  return {
    total: items.length,
    completed,
    remaining: items.length - completed,
    percentage: completionPercentage(completed, items.length),
  };
}

/**
 * A stable identity for the task an event belongs to.
 *
 * `TaskEvent.taskId` becomes null when the task is deleted, so the id is also
 * stored inside `metadata`. Events are compared per task per day, which is what
 * keeps repeated checkbox clicks from inflating a day's completion count.
 */
export function eventTaskKey(event: TaskEventLike): string | null {
  if (event.taskId) return event.taskId;
  if (event.metadata) {
    try {
      const parsed = JSON.parse(event.metadata) as { taskId?: unknown };
      if (typeof parsed?.taskId === "string" && parsed.taskId.length > 0) {
        return parsed.taskId;
      }
    } catch {
      /* ignore malformed metadata */
    }
  }
  return event.id ?? null;
}

/**
 * Bucket events into a day-by-day series.
 *
 * Each task counts at most once per day per action, so toggling a checkbox
 * back and forth cannot inflate the same task's daily completion count.
 */
export function buildActivitySeries(
  events: readonly TaskEventLike[],
  days: readonly string[],
  timeZone: string,
): ActivityPoint[] {
  const completedByDay = new Map<string, Set<string>>();
  const reopenedByDay = new Map<string, Set<string>>();
  const known = new Set(days);

  for (const event of events) {
    if (event.action !== "completed" && event.action !== "reopened") continue;
    const key = eventTaskKey(event);
    if (!key) continue;
    const instant =
      typeof event.timestamp === "string" ? new Date(event.timestamp) : event.timestamp;
    if (Number.isNaN(instant.getTime())) continue;
    const day = dateOnlyInTimeZone(instant, timeZone);
    if (!known.has(day)) continue;
    const bucket = event.action === "completed" ? completedByDay : reopenedByDay;
    const set = bucket.get(day) ?? new Set<string>();
    set.add(key);
    bucket.set(day, set);
  }

  return days.map((date) => ({
    date,
    completed: completedByDay.get(date)?.size ?? 0,
    reopened: reopenedByDay.get(date)?.size ?? 0,
  }));
}

export function activityTotals(series: readonly ActivityPoint[]) {
  return series.reduce(
    (totals, point) => ({
      completed: totals.completed + point.completed,
      reopened: totals.reopened + point.reopened,
    }),
    { completed: 0, reopened: 0 },
  );
}

/** Window of days used by the statistics page and the sidebar trend chart. */
export function activityWindow(days: number, today: string): string[] {
  return lastNDays(today, days);
}

export const ACTIVITY_WINDOWS = [7, 30] as const;
export type ActivityWindow = (typeof ACTIVITY_WINDOWS)[number];

export function isValidActivityWindow(value: number): value is ActivityWindow {
  return (ACTIVITY_WINDOWS as readonly number[]).includes(value);
}

/**
 * The subset of statistics the task workspace and the progress panel need.
 * Kept in this pure module so client components can import the type safely.
 */
export type WorkspaceProgress = {
  parents: ScopeCounts;
  subtasks: ScopeCounts;
  activity: ActivityPoint[];
  windowDays: number;
};
