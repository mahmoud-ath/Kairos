/**
 * Shared value types for Kairos.
 *
 * These are the shapes that cross the server/client boundary, so dates are
 * serialized as strings:
 *  - date-only values (`scheduledDate`, `dueDate`) use `YYYY-MM-DD`
 *  - timestamps (`createdAt`, `completedAt`, ...) use ISO-8601 UTC strings
 */

export type TaskStatus = "TODO" | "DONE";
export type TaskPriority = "NONE" | "LOW" | "MEDIUM" | "HIGH";
export type ThemePreference = "light" | "dark" | "system";

export type LabelDTO = {
  id: string;
  name: string;
  color: string;
};

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
  priority: TaskPriority;
  categoryId: string | null;
  parentId: string | null;
  scheduledDate: string | null;
  dueDate: string | null;
  position: number;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  labels: LabelDTO[];
  subtasks: SubtaskDTO[];
};

export type CategoryDTO = {
  id: string;
  name: string;
  color: string;
  position: number;
  /** Unfinished top-level tasks in this category. */
  openTaskCount: number;
};

export type SettingsDTO = {
  theme: ThemePreference;
  timezone: string;
  weekStartsOn: number;
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
  priority: TaskPriority;
  position: number;
  completedAt: string | null;
};

export type TaskFilters = {
  query: string;
  categoryId: string | "all";
  labelId: string | "all";
  priority: TaskPriority | "all";
  status: "all" | "open" | "done";
};

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

/** Result of a mutating server action, used for optimistic rollback. */
export type MutationResult = ActionResult<undefined>;
