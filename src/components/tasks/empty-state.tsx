"use client";

import { BookOpenCheck, ListChecks, Search, Sparkles, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { loadExampleTasksAction } from "@/server/actions/examples";

/**
 * Empty state with a way forward.
 *
 * Three situations, in priority order:
 *  - the filter matched nothing → say so, and offer to clear it
 *  - nothing has ever been created → offer the example data (an explicit choice;
 *    Kairos never seeds a database silently)
 *  - this view happens to be empty → offer the quick-add field
 */
export function EmptyState({
  title,
  description,
  workspaceIsEmpty,
  onFocusQuickAdd,
  onClearFilter,
}: {
  title: string;
  description: string;
  workspaceIsEmpty: boolean;
  onFocusQuickAdd?: () => void;
  /** Set when the list is empty because of the current filter. */
  onClearFilter?: () => void;
}) {
  const [loading, setLoading] = useState(false);

  async function loadExamples() {
    setLoading(true);
    const result = await loadExampleTasksAction();
    setLoading(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    const { tasks = 0, categories = 0, habits = 0 } = result.data ?? {};
    toast.success("Example data loaded", {
      description: `${tasks} tasks in ${categories} categories, and ${habits} habits with six weeks of history.`,
    });
  }

  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border px-6 py-12 text-center">
      <span className="grid h-10 w-10 place-items-center rounded-full bg-muted text-muted-foreground">
        {onClearFilter ? (
          <Search className="h-5 w-5" />
        ) : workspaceIsEmpty ? (
          <Sparkles className="h-5 w-5" />
        ) : (
          <ListChecks className="h-5 w-5" />
        )}
      </span>
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">{description}</p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        {onClearFilter ? (
          <Button size="sm" onClick={onClearFilter}>
            <X className="mr-1.5 h-3.5 w-3.5" />
            Clear filter
          </Button>
        ) : null}
        {onFocusQuickAdd ? (
          <Button variant="outline" size="sm" onClick={onFocusQuickAdd}>
            Add your first task
          </Button>
        ) : null}
        {workspaceIsEmpty ? (
          <Button size="sm" onClick={loadExamples} disabled={loading}>
            <BookOpenCheck className="mr-1.5 h-3.5 w-3.5" />
            {loading ? "Loading…" : "Load example data"}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
