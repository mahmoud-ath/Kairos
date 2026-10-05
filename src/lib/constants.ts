import type { TaskStatus } from "@/types/kairos";

export const STATUS_LABELS: Record<TaskStatus, string> = {
  TODO: "Open",
  DONE: "Completed",
};

/** Colours offered when creating a category (and auto-assigned in order). */
export const CATEGORY_COLORS = [
  "#f97316",
  "#ef4444",
  "#eab308",
  "#22c55e",
  "#14b8a6",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#64748b",
] as const;

export const THEME_LABELS: Record<string, string> = {
  light: "Light",
  dark: "Dark",
  system: "System",
};

export const WEEKDAY_LABELS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export const TITLE_MAX_LENGTH = 200;
export const NOTES_MAX_LENGTH = 5000;
export const NAME_MAX_LENGTH = 60;

/** Shown for tasks that have no category. */
export const UNCATEGORIZED_LABEL = "Uncategorized";

export const DEFAULT_TIMEZONE = "UTC";
