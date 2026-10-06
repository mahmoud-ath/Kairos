/**
 * Searching.
 *
 * The database already restricts what a page can see (the current view), and
 * categories have their own views in the sidebar, so the only narrowing left is
 * a text search across titles and notes.
 */

import type { TaskDTO, TaskFilters } from "@/types/kairos";

export const DEFAULT_FILTERS: TaskFilters = { query: "" };

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

export function applyFilters(tasks: readonly TaskDTO[], filters: TaskFilters): TaskDTO[] {
  if (!filters.query.trim()) return [...tasks];
  return tasks.filter((task) => matchesQuery(task, filters.query));
}

export function hasActiveFilters(filters: TaskFilters): boolean {
  return filters.query.trim() !== "";
}

export function countActiveFilters(filters: TaskFilters): number {
  return filters.query.trim() === "" ? 0 : 1;
}
