/**
 * Date helpers.
 *
 * Kairos stores "date-only" values (a scheduled day or a deadline) as UTC
 * midnight, so they never shift with the viewer's timezone. Real instants
 * (created/completed timestamps) stay as UTC instants and are converted for
 * display only.
 */

export const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** True when `value` is a real calendar day written as `YYYY-MM-DD`. */
export function isValidDateOnly(value: unknown): value is string {
  if (typeof value !== "string" || !DATE_ONLY_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed.toISOString().slice(0, 10) === value;
}

/** Convert a `YYYY-MM-DD` string into the UTC-midnight `Date` used in SQLite. */
export function dateOnlyToDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

/** Convert a stored UTC-midnight `Date` back into `YYYY-MM-DD`. */
export function dateToDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function toDateOnlyOrNull(value: Date | null | undefined): string | null {
  if (!value) return null;
  return dateToDateOnly(value);
}

/** True when the value looks like a real IANA timezone identifier. */
export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

export function listTimeZones(): string[] {
  const supported = (
    Intl as unknown as { supportedValuesOf?: (key: string) => string[] }
  ).supportedValuesOf;
  if (typeof supported === "function") {
    try {
      return supported("timeZone");
    } catch {
      /* fall through */
    }
  }
  return [
    "UTC",
    "America/Los_Angeles",
    "America/Denver",
    "America/Chicago",
    "America/New_York",
    "America/Sao_Paulo",
    "Europe/London",
    "Europe/Berlin",
    "Europe/Paris",
    "Africa/Cairo",
    "Asia/Jerusalem",
    "Asia/Dubai",
    "Asia/Kolkata",
    "Asia/Shanghai",
    "Asia/Tokyo",
    "Australia/Sydney",
  ];
}

/** The calendar day a given instant falls on, in the user's timezone. */
export function dateOnlyInTimeZone(instant: Date, timeZone: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(instant);
    const year = parts.find((p) => p.type === "year")?.value;
    const month = parts.find((p) => p.type === "month")?.value;
    const day = parts.find((p) => p.type === "day")?.value;
    if (year && month && day) return `${year}-${month}-${day}`;
  } catch {
    /* fall back to UTC below */
  }
  return instant.toISOString().slice(0, 10);
}

/** Today's calendar day in the user's configured timezone. */
export function todayDateOnly(timeZone = "UTC", now: Date = new Date()): string {
  return dateOnlyInTimeZone(now, timeZone);
}

export function addDays(dateOnly: string, days: number): string {
  const base = dateOnlyToDate(dateOnly).getTime() + days * MS_PER_DAY;
  return new Date(base).toISOString().slice(0, 10);
}

/**
 * Shift a date-only value by whole months.
 *
 * The day of month is kept where it exists: 31 Jan + 1 month is 28 Feb (or 29 in
 * a leap year), never 2 or 3 March.
 */
export function addMonths(dateOnly: string, months: number): string {
  const base = dateOnlyToDate(dateOnly);
  const target = new Date(
    Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + months, 1),
  );
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(base.getUTCDate(), lastDay));
  return target.toISOString().slice(0, 10);
}

/** First day of the month containing `dateOnly`. */
export function startOfMonth(dateOnly: string): string {
  return `${dateOnly.slice(0, 7)}-01`;
}

/** Last day of the month containing `dateOnly`. */
export function endOfMonth(dateOnly: string): string {
  return addDays(addMonths(startOfMonth(dateOnly), 1), -1);
}

/** Number of whole days from `from` to `to` (positive when `to` is later). */
export function diffInDays(to: string, from: string): number {
  return Math.round(
    (dateOnlyToDate(to).getTime() - dateOnlyToDate(from).getTime()) / MS_PER_DAY,
  );
}

/** Chronological comparison for `YYYY-MM-DD` strings. */
export function compareDateOnly(a: string, b: string): number {
  return a === b ? 0 : a < b ? -1 : 1;
}

/** True when the date-only value is strictly before `today`. */
export function isDateOnlyPast(value: string, today: string): boolean {
  return compareDateOnly(value, today) < 0;
}

/** First day of the week containing `dateOnly`, honouring `weekStartsOn`. */
export function startOfWeek(dateOnly: string, weekStartsOn: number): string {
  const day = dateOnlyToDate(dateOnly).getUTCDay();
  const delta = (day - weekStartsOn + 7) % 7;
  return addDays(dateOnly, -delta);
}

/** Inclusive list of days between two date-only values. */
export function dateRange(from: string, to: string): string[] {
  const days: string[] = [];
  let cursor = from;
  let guard = 0;
  while (compareDateOnly(cursor, to) <= 0 && guard < 4000) {
    days.push(cursor);
    cursor = addDays(cursor, 1);
    guard += 1;
  }
  return days;
}

/** Last `count` days ending at `today` (inclusive), oldest first. */
export function lastNDays(today: string, count: number): string[] {
  return dateRange(addDays(today, -(count - 1)), today);
}

const WEEKDAY_FORMATTER = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  timeZone: "UTC",
});

const MONTH_DAY_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

export function formatWeekday(dateOnly: string): string {
  return WEEKDAY_FORMATTER.format(dateOnlyToDate(dateOnly));
}

export function formatMonthDay(dateOnly: string): string {
  return MONTH_DAY_FORMATTER.format(dateOnlyToDate(dateOnly));
}

const MONTH_LABEL_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

/** Month heading, e.g. "October 2026". */
export function formatMonthLabel(dateOnly: string): string {
  return MONTH_LABEL_FORMATTER.format(dateOnlyToDate(dateOnly));
}

const MONTH_PARAM_PATTERN = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/;

/**
 * Read a month out of a query string.
 *
 * Accepts both `YYYY-MM` (what the links write — short and readable) and a full
 * `YYYY-MM-DD` value, and always returns the first day of that month. Anything
 * else returns `null` so a hand-edited URL falls back to the current month
 * instead of throwing or rendering an empty grid.
 */
export function parseMonthParam(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = MONTH_PARAM_PATTERN.exec(value.trim());
  if (!match) return null;
  const [, year, month, day] = match;
  const first = `${year}-${month}-01`;
  if (!isValidDateOnly(first)) return null;
  // A full date must still be a real day, so `2026-02-30` is rejected rather
  // than silently treated as February.
  if (day !== undefined && !isValidDateOnly(`${year}-${month}-${day}`)) return null;
  return first;
}

/** The `?month=` value for a date's month, e.g. `2026-10`. */
export function monthParamValue(dateOnly: string): string {
  return dateOnly.slice(0, 7);
}

const FULL_DAY_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
  timeZone: "UTC",
});

/** Spelled-out day, e.g. "October 12" — used by tooltips, not dense rows. */
export function formatFullMonthDay(dateOnly: string): string {
  return FULL_DAY_FORMATTER.format(dateOnlyToDate(dateOnly));
}

/** Human label for a date group heading, relative to today. */
export function formatRelativeDate(dateOnly: string, today: string): string {
  const delta = diffInDays(dateOnly, today);
  if (delta === 0) return "Today";
  if (delta === 1) return "Tomorrow";
  if (delta === -1) return "Yesterday";
  return `${formatWeekday(dateOnly)}, ${formatMonthDay(dateOnly)}`;
}

/** Compact label used on task rows, with a year when it is not the current one. */
export function formatCompactDate(dateOnly: string, today: string): string {
  const delta = diffInDays(dateOnly, today);
  if (delta === 0) return "Today";
  if (delta === 1) return "Tomorrow";
  if (delta === -1) return "Yesterday";
  const sameYear = dateOnly.slice(0, 4) === today.slice(0, 4);
  return sameYear
    ? formatMonthDay(dateOnly)
    : `${formatMonthDay(dateOnly)}, ${dateOnly.slice(0, 4)}`;
}

/** Format a stored instant for display, using the calendar day in `timeZone`. */
export function formatTimestamp(
  instant: string | Date,
  timeZone: string,
  options: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  },
): string {
  const date = typeof instant === "string" ? new Date(instant) : instant;
  if (Number.isNaN(date.getTime())) return "";
  try {
    return new Intl.DateTimeFormat("en-US", { ...options, timeZone }).format(date);
  } catch {
    return new Intl.DateTimeFormat("en-US", { ...options, timeZone: "UTC" }).format(date);
  }
}
