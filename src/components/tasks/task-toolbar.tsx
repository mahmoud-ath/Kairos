"use client";

import { ListFilter, Search, Trash2, X } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { countActiveFilters, DEFAULT_FILTERS } from "@/lib/filters";
import type { CategoryDTO, TaskFilters } from "@/types/kairos";

const ALL = "all";

function FilterSelect({
  value,
  onChange,
  options,
  ariaLabel,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  ariaLabel: string;
  className?: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger aria-label={ariaLabel} className={className}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function TaskToolbar({
  filters,
  onFiltersChange,
  categories,
  resultCount,
  totalCount,
  completedCount,
  clearCompletedCount,
  clearCompletedScope,
  onClearCompleted,
}: {
  filters: TaskFilters;
  onFiltersChange: (filters: TaskFilters) => void;
  categories: readonly CategoryDTO[];
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
  const active = countActiveFilters(filters);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={filters.query}
            onChange={(event) => onFiltersChange({ ...filters, query: event.target.value })}
            placeholder="Search titles and notes"
            aria-label="Search tasks"
            className="h-9 pl-8"
          />
        </div>

        <FilterSelect
          ariaLabel="Filter by category"
          value={filters.categoryId}
          onChange={(value) => onFiltersChange({ ...filters, categoryId: value })}
          className="h-9 w-auto min-w-32 text-xs"
          options={[
            { value: ALL, label: "All categories" },
            { value: "none", label: "Uncategorized" },
            ...categories.map((category) => ({ value: category.id, label: category.name })),
          ]}
        />

        <FilterSelect
          ariaLabel="Filter by status"
          value={filters.status}
          onChange={(value) =>
            onFiltersChange({ ...filters, status: value as TaskFilters["status"] })
          }
          className="h-9 w-auto min-w-28 text-xs"
          options={[
            { value: ALL, label: "Any status" },
            { value: "open", label: "Open only" },
            { value: "done", label: "Completed only" },
          ]}
        />

        {active > 0 ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-9"
            onClick={() => onFiltersChange(DEFAULT_FILTERS)}
          >
            <X className="mr-1 h-3.5 w-3.5" />
            Clear filters ({active})
          </Button>
        ) : null}

        {clearCompletedCount > 0 ? (
          <Button
            variant="outline"
            size="sm"
            className="h-9 text-muted-foreground hover:text-destructive"
            onClick={() => setConfirming(true)}
          >
            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            Clear completed
          </Button>
        ) : null}
      </div>

      <p className="flex items-center gap-1.5 px-1 text-xs text-muted-foreground">
        <ListFilter className="h-3.5 w-3.5" />
        Showing {resultCount} of {totalCount} task{totalCount === 1 ? "" : "s"}
        {completedCount > 0 ? ` · ${completedCount} completed` : ""}
      </p>

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
