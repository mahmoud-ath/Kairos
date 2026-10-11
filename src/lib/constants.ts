import type { FontScale, TaskStatus } from "@/types/kairos";

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

/**
 * Id of the top bar's filter input.
 *
 * The `/` shortcut focuses it by id rather than by label, so renaming the
 * visible wording can never silently break the shortcut.
 */
export const SEARCH_INPUT_ID = "kairos-filter-tasks";

export const WEEKDAY_LABELS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

/**
 * Root font sizes offered by the "Text size" setting, as percentages.
 *
 * Every Tailwind size is expressed in rem, so the root font size scales the
 * whole interface together — text, rows, controls and column widths. `default`
 * matches the value `globals.css` sets, so the setting is a no-op until it is
 * changed. This object is the single source of truth for the available scales.
 */
export const FONT_SCALES: Record<FontScale, number> = {
  compact: 100,
  default: 112.5,
  large: 125,
  larger: 137.5,
};

/** The scale keys, in the order the picker shows them. */
export const FONT_SCALE_KEYS = Object.keys(FONT_SCALES) as FontScale[];

export const FONT_SCALE_LABELS: Record<FontScale, string> = {
  compact: "Compact",
  default: "Default",
  large: "Large",
  larger: "Extra large",
};

export const DEFAULT_FONT_SCALE: FontScale = "default";

export const TITLE_MAX_LENGTH = 200;
export const NOTES_MAX_LENGTH = 5000;
export const NAME_MAX_LENGTH = 60;
export const NICKNAME_MAX_LENGTH = 12;

/** How an account with no nickname and no usable email is greeted. */
export const DEFAULT_NICKNAME = "Chief";

/** Shown for tasks that have no category. */
export const UNCATEGORIZED_LABEL = "Uncategorized";

export const DEFAULT_TIMEZONE = "UTC";
