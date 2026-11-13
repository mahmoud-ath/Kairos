"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Paging controls for a shortened list (the Completed view).
 *
 * Deliberately plain: Previous / Next and a "which slice am I looking at" line.
 * A completed history is read newest-first and rarely jumped around in, so a
 * row of numbered pages would take space without earning it.
 */
export function TaskPagination({
  page,
  pageCount,
  total,
  pageSize,
  onPageChange,
}: {
  /** 1-based current page. */
  page: number;
  pageCount: number;
  /** Tasks in the whole list, not just this page. */
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}) {
  if (pageCount <= 1) return null;

  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);

  return (
    <nav
      aria-label="Pagination"
      className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2"
    >
      <p className="text-xs tabular-nums text-muted-foreground">
        {first}–{last} of {total}
      </p>

      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          className="h-8"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft className="mr-1 h-3.5 w-3.5" />
          Previous
        </Button>

        <span className="px-2 text-xs tabular-nums text-muted-foreground">
          Page {page} of {pageCount}
        </span>

        <Button
          variant="outline"
          size="sm"
          className="h-8"
          disabled={page >= pageCount}
          onClick={() => onPageChange(page + 1)}
          aria-label="Next page"
        >
          Next
          <ChevronRight className="ml-1 h-3.5 w-3.5" />
        </Button>
      </div>
    </nav>
  );
}
