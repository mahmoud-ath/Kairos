/**
 * Habit rules (pure).
 *
 * A habit is the *recipe*: a title, a category and the weekdays it is due on.
 * It stores no progress of its own. Each day the habit is due, Kairos generates
 * one ordinary task from it — the *instance* — which appears in Today and
 * nowhere else. Ticking that task off *is* completing the habit.
 *
 * Everything here therefore derives "how is this habit going" from a plain set
 * of completion dates (`YYYY-MM-DD`, the day the instance belonged to), which
 * the server reads out of the append-only `TaskEvent` log. Keeping the rules in
 * this module means the habits page, the sidebar and the unit tests all agree.
 */

import {
  addDays,
  compareDateOnly,
  dateOnlyToDate,
  lastNDays,
} from "@/lib/dates";
import { habitDayOf, parseTaskEventMetadata } from "@/lib/events";

/** Weekday numbers, `0` = Sunday, matching `Date.prototype.getUTCDay()`. */
export const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6] as const;
export const WEEKDAYS = [1, 2, 3, 4, 5] as const;
export const WEEKENDS = [0, 6] as const;

export const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

/**
 * Two-letter headings for the grid.
 *
 * Single letters repeat (`T`, `S`), which makes a calendar row unreadable.
 */
export const WEEKDAY_TWO_LETTER = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"] as const;

/** How many days the habits page shows as a per-habit strip. */
export const HABIT_HISTORY_DAYS = 7;

/** Window the completion rate ("30-day rate") is measured over. */
export const HABIT_RATE_WINDOW_DAYS = 30;

/**
 * Windows the trend chart can show.
 *
 * 7 is "how is this week going", 30 is the default month view, and 90 shows a
 * quarter — long enough for the shape of a habit to emerge.
 */
export const HABIT_TREND_WINDOWS = [7, 30, 90] as const;
export type HabitTrendWindow = (typeof HABIT_TREND_WINDOWS)[number];

/** True when `value` is one of the windows above. */
export function isValidHabitTrendWindow(value: number): value is HabitTrendWindow {
  return (HABIT_TREND_WINDOWS as readonly number[]).includes(value);
}

/** How many days the rolling average on the trend chart looks back over. */
export const HABIT_ROLLING_AVERAGE_DAYS = 7;

/**
 * Safety stop for the streak walk, and the horizon the server reads completion
 * events over. No habit is expected to be older than about a year.
 */
export const HABIT_STREAK_LOOKBACK_DAYS = 400;

/** The parts of a habit the date rules need. */
export type HabitLike = {
  id: string;
  /** Used by the trend tooltip, which names the habits that were done. */
  title?: string;
  /** Weekday numbers the habit is due on. */
  days: readonly number[];
  /**
   * The first day the habit was due. Days before it are neither due nor missed,
   * so a habit created today does not read as a week of failures.
   */
  startDate?: string | null;
  /**
   * A paused habit stops generating days. Its history is kept, but it is not
   * part of the tracker any more: it is left out of the trend.
   */
  paused?: boolean;
};

/** `habitId` → the set of days that habit was completed on. */
export type HabitCompletionLog = ReadonlyMap<string, ReadonlySet<string>>;

const NO_DAYS: ReadonlySet<string> = new Set<string>();

/** Drop anything that is not a whole weekday, deduplicate and sort. */
export function normaliseHabitDays(days: readonly number[]): number[] {
  const seen = new Set<number>();
  for (const day of days) {
    if (!Number.isInteger(day) || day < 0 || day > 6) continue;
    seen.add(day);
  }
  return [...seen].sort((a, b) => a - b);
}

/** Weekday numbers from the stored `"1,2,3"` string; junk falls back to daily. */
export function parseHabitDays(value: string | null | undefined): number[] {
  if (!value) return [...EVERY_DAY];
  const parsed = normaliseHabitDays(
    value
      .split(",")
      .map((part) => Number.parseInt(part.trim(), 10)),
  );
  return parsed.length > 0 ? parsed : [...EVERY_DAY];
}

/** The stored representation of a weekday selection. */
export function formatHabitDays(days: readonly number[]): string {
  return normaliseHabitDays(days).join(",");
}

/** The weekday of a `YYYY-MM-DD` value. */
export function habitWeekday(dateOnly: string): number {
  return dateOnlyToDate(dateOnly).getUTCDay();
}

/** True when the habit falls on the given day. */
export function isHabitDueOn(days: readonly number[], dateOnly: string): boolean {
  const normalised = normaliseHabitDays(days);
  if (normalised.length === 0) return true; // a broken row still generates
  return normalised.includes(habitWeekday(dateOnly));
}

function sameDays(days: readonly number[], expected: readonly number[]): boolean {
  return days.length === expected.length && days.every((day, i) => day === expected[i]);
}

/**
 * True on (and after) the day the habit started. Before that it simply did not
 * exist, so those days must not count for or against it.
 */
export function isHabitActiveOn(habit: HabitLike, dateOnly: string): boolean {
  if (!habit.startDate) return true;
  return compareDateOnly(dateOnly, habit.startDate) >= 0;
}

/** True when the habit is one the user is expected to do on `dateOnly`. */
export function isHabitDueOnDate(habit: HabitLike, dateOnly: string): boolean {
  return isHabitActiveOn(habit, dateOnly) && isHabitDueOn(habit.days, dateOnly);
}

/**
 * True when this day may be ticked off (or un-ticked) by hand.
 *
 * A day can be corrected after the fact, but only a day the habit is actually
 * due on, and never one that has not happened yet. The server applies this same
 * rule, so the grid and the data cannot disagree.
 */
export function isHabitDayEditable(
  habit: HabitLike,
  dateOnly: string,
  today: string,
): boolean {
  return isHabitDueOnDate(habit, dateOnly) && compareDateOnly(dateOnly, today) <= 0;
}

/** Human label for a weekday selection: "Every day", "Weekdays", "Mon, Wed". */
export function describeHabitCadence(days: readonly number[]): string {
  const normalised = normaliseHabitDays(days);
  if (sameDays(normalised, EVERY_DAY)) return "Every day";
  if (sameDays(normalised, WEEKDAYS)) return "Weekdays";
  if (sameDays(normalised, WEEKENDS)) return "Weekends";
  return normalised.map((day) => WEEKDAY_SHORT[day]).join(", ");
}

function completionsFor(
  completions: HabitCompletionLog,
  habitId: string,
): ReadonlySet<string> {
  return completions.get(habitId) ?? NO_DAYS;
}

/** One day of a habit's recent history, as the habits page renders it. */
export type HabitDay = {
  date: string;
  /** The habit falls on this day. */
  due: boolean;
  /** An instance exists for this day and was completed. */
  done: boolean;
};

/**
 * The last `spanDays` days (oldest first), each marked due / not due and done /
 * not done. Days the habit is not due on — and days before it started — are
 * neither a hit nor a miss.
 */
export function habitHistory(
  habit: HabitLike,
  completions: HabitCompletionLog,
  today: string,
  spanDays: number = HABIT_HISTORY_DAYS,
): HabitDay[] {
  const done = completionsFor(completions, habit.id);
  return lastNDays(today, spanDays).map((date) => ({
    date,
    due: isHabitDueOnDate(habit, date),
    done: done.has(date),
  }));
}

/**
 * Consecutive due days completed, counting back from today.
 *
 * Today does not break the streak while it is still in progress: an unfinished
 * habit is only a miss once the day is over. Days the habit is not due on are
 * skipped, so a Mon/Wed/Fri habit keeps one unbroken streak across the weekend.
 */
export function habitStreak(
  habit: HabitLike,
  completions: HabitCompletionLog,
  today: string,
): number {
  const done = completionsFor(completions, habit.id);

  let cursor = today;
  if (isHabitDueOnDate(habit, cursor) && !done.has(cursor)) {
    cursor = addDays(cursor, -1); // today is still open
  }

  let streak = 0;
  for (let step = 0; step < HABIT_STREAK_LOOKBACK_DAYS; step += 1) {
    // The habit did not exist before its start day, so the streak ends there.
    if (!isHabitActiveOn(habit, cursor)) break;
    if (isHabitDueOn(habit.days, cursor)) {
      if (!done.has(cursor)) break;
      streak += 1;
    }
    cursor = addDays(cursor, -1);
  }
  return streak;
}

/**
 * Share of due days completed over the last `spanDays` days, as a percentage.
 *
 * Days before the habit started are not due days at all, and today is counted as
 * a hit once it is done and otherwise left out entirely, so an unfinished habit
 * does not look like a failure before the day is over.
 */
export function habitCompletionRate(
  habit: HabitLike,
  completions: HabitCompletionLog,
  today: string,
  spanDays: number = HABIT_RATE_WINDOW_DAYS,
): number {
  const done = completionsFor(completions, habit.id);

  let due = 0;
  let completed = 0;
  for (const date of lastNDays(today, spanDays)) {
    if (!isHabitDueOnDate(habit, date)) continue;
    if (date === today && !done.has(date)) continue;
    due += 1;
    if (done.has(date)) completed += 1;
  }

  return due === 0 ? 0 : Math.round((completed / due) * 100);
}

/* -------------------------------------------------------------------------- */
/* The last 30 days, across every habit                                      */
/* -------------------------------------------------------------------------- */

/** One day of the consistency trend: how much of that day's work was done. */
export type HabitTrendPoint = {
  date: string;
  /** Habits that expected something on this day. */
  due: number;
  /** Of those, the ones ticked off. */
  done: number;
  /** `done / due` as a percentage, or `null` when nothing was due. */
  percent: number | null;
  /**
   * Habits that expected something, and the ones that were ticked off.
   *
   * Ids rather than titles: the client already holds the habit list, and a
   * 90-day window would otherwise repeat every title ninety times.
   */
  dueIds: string[];
  doneIds: string[];
  /**
   * Trailing `HABIT_ROLLING_AVERAGE_DAYS`-day mean of `percent`, ignoring days
   * with nothing due — the trend behind the daily noise.
   */
  average: number | null;
};

/**
 * Day-by-day completion across all habits — the trend chart.
 *
 * A day with nothing due reports `percent: null` rather than 0, so a weekend
 * nobody owed anything on is a gap in the line, not a failure. Paused habits are
 * not tracked and are left out entirely.
 */
export function habitTrend(
  habits: readonly HabitLike[],
  completions: HabitCompletionLog,
  today: string,
  spanDays: number = HABIT_RATE_WINDOW_DAYS,
): HabitTrendPoint[] {
  const tracked = habits.filter((habit) => !habit.paused);
  const days = lastNDays(today, spanDays);

  const percents: (number | null)[] = [];
  const points = days.map((date) => {
    const dueIds: string[] = [];
    const doneIds: string[] = [];
    for (const habit of tracked) {
      if (!isHabitDueOnDate(habit, date)) continue;
      dueIds.push(habit.id);
      if (completionsFor(completions, habit.id).has(date)) doneIds.push(habit.id);
    }

    const percent = dueIds.length === 0 ? null : Math.round((doneIds.length / dueIds.length) * 100);
    percents.push(percent);

    // The average trails the point, so it is computed from the percents so far.
    const window = percents
      .slice(Math.max(0, percents.length - HABIT_ROLLING_AVERAGE_DAYS))
      .filter((value): value is number => value !== null);
    const average =
      window.length === 0
        ? null
        : Math.round(window.reduce((total, value) => total + value, 0) / window.length);

    return {
      date,
      due: dueIds.length,
      done: doneIds.length,
      percent,
      dueIds,
      doneIds,
      average,
    };
  });

  return points;
}

/** Days in the window with at least one check-in. */
export function trendCheckInDays(points: readonly HabitTrendPoint[]): number {
  return points.filter((point) => point.done > 0).length;
}

/** Days in the window on which every due habit was done. */
export function trendPerfectDays(points: readonly HabitTrendPoint[]): number {
  return points.filter((point) => point.percent === 100).length;
}

/** Mean completion across the days that had something due, or `null`. */
export function trendAverage(points: readonly HabitTrendPoint[]): number | null {
  const scored = points
    .map((point) => point.percent)
    .filter((value): value is number => value !== null);
  if (scored.length === 0) return null;
  return Math.round(scored.reduce((total, value) => total + value, 0) / scored.length);
}

/** The strongest day in the window, or `null` when nothing was ever done. */
export function trendBest(points: readonly HabitTrendPoint[]): HabitTrendPoint | null {
  let best: HabitTrendPoint | null = null;
  for (const point of points) {
    if (point.percent === null || point.percent <= 0) continue;
    if (!best || point.percent > (best.percent ?? 0)) best = point;
  }
  return best;
}

/**
 * Turn `TaskEvent` rows into the completion log.
 *
 * A habit day is named by `{ habitId, habitDate }` in the event metadata — the
 * day the instance *belonged to*, not the moment the event happened, so a habit
 * ticked off just after midnight still counts for the right day.
 *
 * The log is folded rather than collected, in timestamp order: `completed` adds
 * the day and `reopened` takes it back off. That is what makes un-ticking a day
 * (in the month grid, or in Today) actually undo it, while the event log itself
 * stays append-only — and a day completed, reopened and completed again ends up
 * done, because the last event wins.
 *
 * Malformed metadata is read through `parseTaskEventMetadata`, which never
 * throws and accepts the older `date` field name, so history written by earlier
 * versions still counts. See `lib/events.ts`.
 */
export function buildHabitCompletionLog(
  events: Iterable<{
    action: string;
    metadata: string | null | undefined;
  }>,
): HabitCompletionLog {
  const log = new Map<string, Set<string>>();

  for (const event of events) {
    if (!event.metadata) continue;
    if (event.action !== "completed" && event.action !== "reopened") continue;

    const day = habitDayOf(parseTaskEventMetadata(event.metadata));
    if (!day) continue;

    if (event.action === "completed") {
      const set = log.get(day.habitId) ?? new Set<string>();
      set.add(day.habitDate);
      log.set(day.habitId, set);
    } else {
      log.get(day.habitId)?.delete(day.habitDate);
    }
  }

  return log;
}
