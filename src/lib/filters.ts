/**
 * Filtering.
 *
 * The database already restricts what a page can see (the current view), so the
 * controls here narrow what is left: a text search across titles and notes, and
 * — in All Tasks — a category.
 *
 * "No category" is a **value**, not the absence of a filter: selecting it keeps
 * exactly the tasks whose `categoryId` is null (see `lib/categories.ts`). That is
 * what makes the bucket behave like any other category here.
 */

import { categoryKey } from "@/lib/categories";
import type { TaskDTO, TaskFilters } from "@/types/kairos";

export const DEFAULT_FILTERS: TaskFilters = { query: "", categoryId: null };

/** Case-insensitive match across title and notes; every term must match. */
export function matchesQuery(task: TaskDTO, query: string): boolean {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return true;
  const haystack = `${task.title}\n${task.notes ?? ""}`.toLowerCase();
  return trimmed
    .split(/\s+/)
    .filter(Boolean)
    .every((term) => haystack.includes(term));
}

/**
 * Does the task belong to the selected category bucket?
 *
 * `null` selects every category (the filter is off). Any other value is compared
 * against the task's category *key*, so `UNCATEGORIZED_ID` matches tasks with no
 * category and nothing else.
 */
export function matchesCategory(
  task: { categoryId: string | null },
  categoryId: string | null,
): boolean {
  if (categoryId === null) return true;
  return categoryKey(task.categoryId) === categoryId;
}

export function applyFilters(tasks: readonly TaskDTO[], filters: TaskFilters): TaskDTO[] {
  const query = filters.query.trim();
  if (!query && filters.categoryId === null) return [...tasks];
  return tasks.filter(
    (task) => matchesCategory(task, filters.categoryId) && matchesQuery(task, query),
  );
}

export function hasActiveFilters(filters: TaskFilters): boolean {
  return filters.query.trim() !== "" || filters.categoryId !== null;
}

/** How many controls are narrowing the list, for the toolbar's copy. */
export function countActiveFilters(filters: TaskFilters): number {
  let count = 0;
  if (filters.query.trim() !== "") count += 1;
  if (filters.categoryId !== null) count += 1;
  return count;
}
