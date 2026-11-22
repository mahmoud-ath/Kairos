/**
 * Statistics helpers (pure).
 *
 * Kairos keeps two distinct ideas apart:
 *  - *current* state: how many parent tasks are done vs. remaining right now
 *    (derived from the task table)
 *  - *historical* activity: how much work was completed on each day, derived
 *    from immutable `TaskEvent` rows so it survives reopens and edits.
 */

import {
  addDays,
  compareDateOnly,
  dateOnlyInTimeZone,
  dateRange,
  diffInDays,
  formatMonthDay,
  formatMonthDayYear,
  isValidDateOnly,
  lastNDays,
} from "@/lib/dates";
import { isHabitEventMetadata, parseTaskEventMetadata } from "@/lib/events";

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
    const taskId = parseTaskEventMetadata(event.metadata).taskId;
    if (taskId) return taskId;
  }
  return event.id ?? null;
}

/**
 * True when the event was written for a habit's generated task.
 *
 * Habit instances are quarantined out of every task view, so their completions
 * are left out of the task statistics too — otherwise `activity` would count
 * work that `parents` deliberately excludes, and the same page would disagree
 * with itself. Habits have their own page.
 */
export function isHabitEvent(event: TaskEventLike): boolean {
  if (!event.metadata) return false;
  return isHabitEventMetadata(parseTaskEventMetadata(event.metadata));
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
    if (isHabitEvent(event)) continue;
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

/** The one-click windows offered by the statistics page. */
export const ACTIVITY_PRESETS = [7, 30, 90] as const;
export type ActivityPreset = (typeof ACTIVITY_PRESETS)[number];
export const DEFAULT_ACTIVITY_PRESET: ActivityPreset = 7;

/**
 * Hard ceiling for a custom range.
 *
 * A year of days is 366 buckets, which the chart can still render; anything
 * longer is clamped rather than rejected, so a hand-edited URL cannot ask for a
 * decade of bars.
 */
export const ACTIVITY_RANGE_MAX_DAYS = 366;

/** At or above this many days the activity chart buckets per week. */
export const ACTIVITY_WEEKLY_THRESHOLD_DAYS = 90;

/** A resolved statistics window: inclusive dates plus what to render. */
export type ActivityRange = {
  from: string;
  to: string;
  /** Every day in the window, oldest first. */
  days: string[];
  /** Number of days covered, inclusive. */
  windowDays: number;
  /** The preset this range came from, or `null` for a custom range. */
  preset: ActivityPreset | null;
  /** Human label: "30 days" or "Sep 1 – Nov 22". */
  label: string;
  /** True when `days` should be aggregated per week for display. */
  weekly: boolean;
};

export function isValidActivityPreset(value: number): value is ActivityPreset {
  return (ACTIVITY_PRESETS as readonly number[]).includes(value);
}

function buildActivityRange(
  from: string,
  to: string,
  preset: ActivityPreset | null,
): ActivityRange {
  const days = dateRange(from, to);
  const crossesYear = from.slice(0, 4) !== to.slice(0, 4);
  return {
    from,
    to,
    days,
    windowDays: days.length,
    preset,
    label:
      from === to
        ? formatMonthDay(from)
        : crossesYear
          ? `${formatMonthDayYear(from)} – ${formatMonthDayYear(to)}`
          : `${formatMonthDay(from)} – ${formatMonthDay(to)}`,
    weekly: days.length > ACTIVITY_WEEKLY_THRESHOLD_DAYS,
  };
}

/** A range ending today and covering the last `days` days. */
export function activityRangeForDays(today: string, days: number): ActivityRange {
  const preset = isValidActivityPreset(days) ? days : null;
  const count = Math.min(Math.max(Math.round(days) || 1, 1), ACTIVITY_RANGE_MAX_DAYS);
  return buildActivityRange(addDays(today, -(count - 1)), today, preset);
}

/**
 * Resolve the statistics window from the query string.
 *
 * `?from=&to=` wins when both are real dates (swapped if reversed, never later
 * than today, clamped to `ACTIVITY_RANGE_MAX_DAYS`); otherwise `?range=7|30|90`
 * is honoured, and anything else falls back to the 7-day default.
 */
export function resolveActivityRange(
  params: { range?: string | null; from?: string | null; to?: string | null },
  today: string,
): ActivityRange {
  if (isValidDateOnly(params.from) && isValidDateOnly(params.to)) {
    let from = params.from;
    let to = params.to;
    if (compareDateOnly(from, to) > 0) [from, to] = [to, from];
    // The future holds no history, so a range that reaches past today ends today.
    if (compareDateOnly(to, today) > 0) to = today;
    if (compareDateOnly(from, to) > 0) from = to;
    if (diffInDays(to, from) + 1 > ACTIVITY_RANGE_MAX_DAYS) {
      from = addDays(to, -(ACTIVITY_RANGE_MAX_DAYS - 1));
    }
    return buildActivityRange(from, to, null);
  }

  const requested = Number(params.range);
  return activityRangeForDays(
    today,
    isValidActivityPreset(requested) ? requested : DEFAULT_ACTIVITY_PRESET,
  );
}

/**
 * Sum a daily series into consecutive 7-day buckets, counted backwards from the
 * last day so the most recent bucket is always a full week.
 */
export function bucketActivityByWeek(points: readonly ActivityPoint[]): ActivityPoint[] {
  const buckets: ActivityPoint[] = [];
  let end = points.length;
  while (end > 0) {
    const start = Math.max(0, end - 7);
    const chunk = points.slice(start, end);
    buckets.unshift({
      date: chunk[0]!.date,
      completed: chunk.reduce((total, point) => total + point.completed, 0),
      reopened: chunk.reduce((total, point) => total + point.reopened, 0),
    });
    end = start;
  }
  return buckets;
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
