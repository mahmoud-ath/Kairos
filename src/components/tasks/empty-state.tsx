"use client";

import { ListChecks, Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * The quiet message for a view that has nothing to show.
 *
 * Two situations reach it, and only once the workspace holds something:
 *
 * - a filter matched nothing, offered with a way to clear it;
 * - this particular view is empty while others are not.
 *
 * A brand-new workspace deliberately gets **nothing** here. The quick-add field
 * sits directly above, so an empty view is already self-explanatory — a block
 * explaining that there is nothing yet, plus a button offering demo data, stood
 * between the person and their first task.
 */
export function EmptyState({
  title,
  description,
  onClearFilter,
}: {
  title: string;
  description: string;
  /** Set when the list is empty because of the current filter. */
  onClearFilter?: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border px-6 py-12 text-center">
      <span className="grid h-10 w-10 place-items-center rounded-full bg-muted text-muted-foreground">
        {onClearFilter ? (
          <Search className="h-5 w-5" />
        ) : (
          <ListChecks className="h-5 w-5" />
        )}
      </span>
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">{description}</p>
      </div>

      {onClearFilter ? (
        <Button size="sm" onClick={onClearFilter}>
          <X className="mr-1.5 h-3.5 w-3.5" />
          Clear filter
        </Button>
      ) : null}
    </div>
  );
}
