/**
 * Category identity — including "no category".
 *
 * A task can have no category. That is what deleting its category leaves
 * behind, and what the "No category" option in the pickers produces. Leaving
 * that as an anonymous `null` means the same absence is special-cased in every
 * layer that groups or filters: the sidebar counters skip it, statistics invents
 * a row for it, and a filter cannot ask for it at all.
 *
 * So "no category" gets an id of its own: `UNCATEGORIZED_ID`. It is **not** a
 * row in the database and never can be one — a cuid is alphanumeric, so a value
 * containing underscores cannot collide with a real category id. It is the key
 * the rest of the app uses to mean *the bucket of tasks whose category is null*,
 * which is what makes "no category" filterable, countable and renderable exactly
 * like any other category.
 *
 * This is deliberately a key, not a migration: the data stays honest (a deleted
 * category really is absent, it is not silently replaced by a hidden row), while
 * every read path gets one stable answer to "which category is this?".
 */

import { UNCATEGORIZED_LABEL } from "@/lib/constants";

/** Key for tasks with no category. Never a real category id (see above). */
export const UNCATEGORIZED_ID = "__uncategorized__";

/** Neutral colour, so the bucket reads as "no category" rather than as a brand. */
export const UNCATEGORIZED_COLOR = "#94a3b8";

/**
 * The category key for a task: its own id, or the bucket it lands in.
 *
 * One function rather than `task.categoryId ?? ...` scattered around, so the
 * sentinel can never drift between the counters, the filter and statistics.
 */
export function categoryKey(categoryId: string | null | undefined): string {
  return categoryId ?? UNCATEGORIZED_ID;
}

/** True when this key is the no-category bucket. */
export function isUncategorizedKey(key: string | null | undefined): boolean {
  return key === UNCATEGORIZED_ID;
}

/** True when a task itself has no category. */
export function isUncategorized(categoryId: string | null | undefined): boolean {
  return categoryId === null || categoryId === undefined;
}

/**
 * Human label for a filter value.
 *
 * `null` means "every category" and has no row of its own, so it returns `null`
 * and callers fall back to their own wording ("All tasks").
 */
export function categoryFilterLabel(
  categoryId: string | null,
  categories: readonly { id: string; name: string }[],
): string | null {
  if (categoryId === null) return null;
  if (isUncategorizedKey(categoryId)) return UNCATEGORIZED_LABEL;
  return categories.find((category) => category.id === categoryId)?.name ?? null;
}
