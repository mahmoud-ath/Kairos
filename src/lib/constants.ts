import type { TaskStatus } from "@/types/kairos";

export const STATUS_LABELS: Record<TaskStatus, string> = {
  TODO: "Open",
  DONE: "Completed",
};

/** Colours offered when creating a category (and auto-assigned in order). */
export const CATEGORY_COLORS = [
  "#22c55e",
  "#0ea5e9",
  "#8b5cf6",
  "#ec4899",
  "#f97316",
  "#eab308",
  "#14b8a6",
  "#ef4444",
  "#64748b",
] as const;

export const THEME_LABELS: Record<string, string> = {
  light: "Light",
  dark: "Dark",
  system: "System",
};

/**
 * Where `next-themes` keeps the visitor's choice.
 *
 * Read in two places: the toggle writes it, and the workspace only applies the
 * theme stored in the database when this browser has never expressed one — a
 * choice made here is newer than a stored preference.
 */
export const THEME_STORAGE_KEY = "kairos-theme";

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
