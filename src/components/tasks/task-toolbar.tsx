"use client";

import { ListFilter, Trash2, X } from "lucide-react";
import { useState } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { UNCATEGORIZED_ID } from "@/lib/categories";
import { UNCATEGORIZED_LABEL } from "@/lib/constants";
import type { CategoryDTO } from "@/types/kairos";

/**
 * The view header: a summary line, an optional category filter and
 * "clear completed".
 *
 * The text filter lives in the app top bar, because it narrows whatever page is
 * open — this component reports how many tasks matched it and offers a way to
 * clear it. The category filter is handed in by All Tasks only: a category view
 * is already narrowed to one category, so the control would be a tautology
 * there.
 *
 * "No category" appears as an ordinary option, not as the absence of a filter,
 * because that is how the rest of the app treats it (see `lib/categories.ts`).
 */
export function TaskToolbar({
  filtering,
  onClearFilter,
  resultCount,
  totalCount,
  completedCount,
  clearCompletedCount,
  clearCompletedScope,
  onClearCompleted,
  categoryFilter,
}: {
  /** True while any filter is narrowing the list. */
  filtering: boolean;
  /** Clears the filters (text and category). */
  onClearFilter: () => void;
  resultCount: number;
  totalCount: number;
  /** Completed tasks visible in this view (shown in the summary line). */
  completedCount: number;
  /** Completed tasks the clear action would actually delete. */
  clearCompletedCount: number;
  clearCompletedScope: "all" | "category";
  onClearCompleted: () => Promise<void>;
  /** Category narrowing; omitted in views that are already one category. */
  categoryFilter?: {
    value: string | null;
    categories: readonly CategoryDTO[];
    /** Open-task counts per category key, including `UNCATEGORIZED_ID`. */
    counts: Record<string, number>;
    onChange: (value: string | null) => void;
  };
}) {
  const [confirming, setConfirming] = useState(false);
  const [clearing, setClearing] = useState(false);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
          {filtering ? (
            <>
              <ListFilter className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="tabular-nums">
                {resultCount} matching task{resultCount === 1 ? "" : "s"}
              </span>
              <span aria-hidden="true">·</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                onClick={onClearFilter}
              >
                <X className="mr-1 h-3 w-3" />
                Clear filter
              </Button>
            </>
          ) : (
            <>
              <span className="tabular-nums">
                {totalCount} task{totalCount === 1 ? "" : "s"}
              </span>
              {completedCount > 0 ? (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums">{completedCount} done</span>
                </>
              ) : null}
            </>
          )}
        </p>

        <div className="flex items-center gap-2">
          {categoryFilter ? (
            <select
              aria-label="Filter by category"
              value={categoryFilter.value ?? ""}
              onChange={(event) =>
                categoryFilter.onChange(event.target.value === "" ? null : event.target.value)
              }
              className="h-8 max-w-48 rounded-md border border-border bg-background px-2 text-xs transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">All categories</option>
              {categoryFilter.categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name} ({categoryFilter.counts[category.id] ?? 0})
                </option>
              ))}
              <option value={UNCATEGORIZED_ID}>
                {UNCATEGORIZED_LABEL} ({categoryFilter.counts[UNCATEGORIZED_ID] ?? 0})
              </option>
            </select>
          ) : null}

          {clearCompletedCount > 0 ? (
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-muted-foreground hover:text-destructive"
              onClick={() => setConfirming(true)}
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              Clear completed
            </Button>
          ) : null}
        </div>
      </div>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {clearCompletedCount} completed task
              {clearCompletedCount === 1 ? "" : "s"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {clearCompletedScope === "category"
                ? "Every completed task in this category is removed permanently, together with its subtasks."
                : "Every completed task is removed permanently, together with its subtasks — including ones in other views."}{" "}
              Export a backup first if you want to keep the history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={clearing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={clearing}
              onClick={async (event) => {
                event.preventDefault();
                setClearing(true);
                await onClearCompleted();
                setClearing(false);
                setConfirming(false);
              }}
            >
              {clearing ? "Deleting…" : "Delete completed"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
