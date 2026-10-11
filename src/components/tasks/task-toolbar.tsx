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

/**
 * The view header: a summary line and "clear completed".
 *
 * The filter box itself lives in the app top bar, because it narrows whatever
 * page is open — this component reports how many tasks matched it and offers a
 * way to clear it.
 *
 * Category and status filter dropdowns were removed: categories have their own
 * views in the sidebar, and the status of a task is visible on the row.
 */
export function TaskToolbar({
  searching,
  onClearFilter,
  resultCount,
  totalCount,
  completedCount,
  clearCompletedCount,
  clearCompletedScope,
  onClearCompleted,
}: {
  /** True while a filter is narrowing the list. */
  searching: boolean;
  /** Clears the top bar's filter box. */
  onClearFilter: () => void;
  resultCount: number;
  totalCount: number;
  /** Completed tasks visible in this view (shown in the summary line). */
  completedCount: number;
  /** Completed tasks the clear action would actually delete. */
  clearCompletedCount: number;
  clearCompletedScope: "all" | "category";
  onClearCompleted: () => Promise<void>;
}) {
  const [confirming, setConfirming] = useState(false);
  const [clearing, setClearing] = useState(false);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
          {searching ? (
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
