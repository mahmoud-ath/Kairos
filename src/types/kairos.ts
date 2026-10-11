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
};

/** The only narrowing control left is a text search. */
export type TaskFilters = {
  query: string;
};

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

/** Result of a mutating server action, used for optimistic rollback. */
export type MutationResult = ActionResult<undefined>;
