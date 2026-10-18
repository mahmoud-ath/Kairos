/**
 * Shared value types for Kairos.
 *
 * These are the shapes that cross the server/client boundary, so dates are
 * serialized as strings:
 *  - date-only values (`scheduledDate`, `dueDate`) use `YYYY-MM-DD`
 *  - timestamps (`createdAt`, `completedAt`, ...) use ISO-8601 UTC strings
 */

export type TaskStatus = "TODO" | "DONE";
export type ThemePreference = "light" | "dark" | "system";

/** Root font-size scale for the whole app (see FONT_SCALES in lib/constants). */
export type FontScale = "compact" | "default" | "large" | "larger";

export type SubtaskDTO = {
  id: string;
  title: string;
  status: TaskStatus;
  position: number;
  completedAt: string | null;
};

export type TaskDTO = {
  id: string;
  title: string;
  notes: string | null;
  status: TaskStatus;
  /** Tasks have at most one category; subtasks inherit their parent's. */
  categoryId: string | null;
  parentId: string | null;
  scheduledDate: string | null;
  dueDate: string | null;
  position: number;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  /**
   * Set when this task is one day's generated instance of a habit. Such a task
   * is configured on the Habits page, only ever appears in Today, and is never
   * renamed, moved, nested or deleted from the task list.
   */
  habitId: string | null;
  subtasks: SubtaskDTO[];
};

export type CategoryDTO = {
  id: string;
  name: string;
  color: string;
  /** Lucide icon name (see `src/lib/category-icons.ts`). */
  icon: string;
  position: number;
  /** Unfinished top-level tasks in this category. */
  openTaskCount: number;
};

export type SettingsDTO = {
  theme: ThemePreference;
  timezone: string;
  weekStartsOn: number;
  /** How the account is greeted; `null` falls back to an email-derived name. */
  nickname: string | null;
  /** Chosen avatar id (see `src/lib/avatars.ts`). */
  avatarId: string;
  /** Root font-size scale for the whole interface. */
  fontScale: FontScale;
  /** Hour of the day (0-23, in this account's timezone) for the daily reminder. */
  reminderHour: number;
};

/** The parts of the profile a person can change themselves. */
export type ProfileDTO = {
  nickname: string | null;
  avatarId: string;
};

/**
 * Lightweight task shape used for counters and trees where the full DTO is not
 * needed. Satisfies the `TaskLike` contract used by the grouping helpers.
 */
export type TaskSummary = {
  id: string;
  status: TaskStatus;
  categoryId: string | null;
  scheduledDate: string | null;
  dueDate: string | null;
  position: number;
  completedAt: string | null;
  /** Non-null when this row is a generated habit instance (see `TaskDTO`). */
  habitId: string | null;
};

/**
 * What narrows a task list: a text search, and — in All Tasks — one category.
 *
 * `categoryId` is a real category id, `UNCATEGORIZED_ID` (the bucket for tasks
 * with no category, see `lib/categories.ts`), or `null` for "no category filter".
 */
export type TaskFilters = {
  query: string;
  categoryId: string | null;
};

/**
 * A habit: the recipe a daily task is generated from.
 *
 * `days` is already parsed into weekday numbers here, so the client never has to
 * know how the value is stored.
 */
export type HabitDTO = {
  id: string;
  title: string;
  notes: string | null;
  categoryId: string | null;
  /** Weekday numbers the habit is due on (0 = Sunday … 6 = Saturday). */
  days: number[];
  position: number;
  /** A paused habit keeps its history but generates no new days. */
  paused: boolean;
  /** The first day the habit is due; earlier days are not counted either way. */
  startDate: string;
};

/** One day of a habit's history, for the month grid. */
export type HabitDayDTO = {
  date: string;
  due: boolean;
  done: boolean;
};

/**
 * Derived habit progress. Never stored: it is computed from the completion
 * history of the generated tasks, so it is always a *view* of the data.
 */
export type HabitProgress = {
  habitId: string;
  /** The habit falls on today. */
  dueToday: boolean;
  /** Today's generated task is ticked off. */
  doneToday: boolean;
  /** Consecutive due days completed, counting back from today. */
  streak: number;
  /** Share of due days completed over the recent window, 0–100. */
  rate: number;
};

/** The month the habits grid is showing. */
export type HabitMonth = {
  /** First day of the month. */
  first: string;
  /** Heading, e.g. "October 2026". */
  label: string;
  /** Every day of the month, oldest first. */
  days: string[];
  /** A month earlier than the current one exists to move back to. */
  canGoPrevious: boolean;
  /** The grid is not already showing the current month. */
  canGoNext: boolean;
};

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

/** Result of a mutating server action, used for optimistic rollback. */
export type MutationResult = ActionResult<undefined>;
