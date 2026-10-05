/**
 * Client-side filtering and searching.
 *
 * The database already restricts what a page can see (scope). These filters
 * narrow the loaded set further using the search box and filter controls.
 */

import type { TaskDTO, TaskFilters } from "@/types/kairos";

export const DEFAULT_FILTERS: TaskFilters = {
  query: "",
  categoryId: "all",
  status: "all",
};

/** Case-insensitive match across title and notes. */
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
  return tasks.filter((task) => {
    if (!matchesQuery(task, filters.query)) return false;

    if (filters.categoryId !== "all") {
      if (filters.categoryId === "none") {
        if (task.categoryId !== null) return false;
      } else if (task.categoryId !== filters.categoryId) {
        return false;
      }
    }

    if (filters.status === "open" && task.status !== "TODO") return false;
    if (filters.status === "done" && task.status !== "DONE") return false;

    return true;
  });
}

export function hasActiveFilters(filters: TaskFilters): boolean {
  return (
    filters.query.trim() !== "" || filters.categoryId !== "all" || filters.status !== "all"
  );
}

export function countActiveFilters(filters: TaskFilters): number {
  let count = 0;
  if (filters.query.trim() !== "") count += 1;
  if (filters.categoryId !== "all") count += 1;
  if (filters.status !== "all") count += 1;
  return count;
}

/** Whether completed tasks should appear for the given filter selection. */
export function filtersIncludeCompleted(filters: TaskFilters): boolean {
  return filters.status !== "open";
}
