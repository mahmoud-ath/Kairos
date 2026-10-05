import type { TaskPriority, TaskStatus } from "@/types/kairos";

export const PRIORITIES: TaskPriority[] = ["NONE", "LOW", "MEDIUM", "HIGH"];

export const PRIORITY_META: Record<
  TaskPriority,
  { label: string; short: string; className: string; dot: string }
> = {
  NONE: {
    label: "No priority",
    short: "—",
    className: "text-muted-foreground",
    dot: "border border-muted-foreground/50 bg-transparent",
  },
  LOW: {
    label: "Low",
    short: "Low",
    className: "text-sky-700 dark:text-sky-400",
    dot: "bg-sky-600 dark:bg-sky-400",
  },
  MEDIUM: {
    label: "Medium",
    short: "Med",
    className: "text-amber-700 dark:text-amber-400",
    dot: "bg-amber-600 dark:bg-amber-400",
  },
  HIGH: {
    label: "High",
    short: "High",
    className: "text-red-700 dark:text-red-400",
    dot: "bg-red-600 dark:text-red-400",
  },
};

export const STATUS_LABELS: Record<TaskStatus, string> = {
  TODO: "Open",
  DONE: "Completed",
};

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

export const LABEL_COLORS = CATEGORY_COLORS;

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

/** Fallback used when a task has no category: "Uncategorized". */
export const UNCATEGORIZED_LABEL = "Uncategorized";

export const DEFAULT_TIMEZONE = "UTC";
