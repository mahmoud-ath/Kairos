"use client";

import { BookOpenCheck, ListChecks, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { loadExampleTasksAction } from "@/server/actions/examples";

/**
 * Empty state with a way forward.
 *
 * When the whole workspace is empty (nothing has ever been created) the user can
 * load a small set of example tasks. This is always an explicit choice — Kairos
 * never seeds a database silently.
 */
export function EmptyState({
  title,
  description,
  workspaceIsEmpty,
  onFocusQuickAdd,
}: {
  title: string;
  description: string;
  workspaceIsEmpty: boolean;
  onFocusQuickAdd?: () => void;
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
    toast.success(
      `Loaded ${result.data?.tasks ?? 0} example tasks in ${result.data?.categories ?? 0} categories`,
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border px-6 py-12 text-center">
      <span className="grid h-10 w-10 place-items-center rounded-full bg-muted text-muted-foreground">
        {workspaceIsEmpty ? (
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
        {onFocusQuickAdd ? (
          <Button variant="outline" size="sm" onClick={onFocusQuickAdd}>
            Add your first task
          </Button>
        ) : null}
        {workspaceIsEmpty ? (
          <Button size="sm" onClick={loadExamples} disabled={loading}>
            <BookOpenCheck className="mr-1.5 h-3.5 w-3.5" />
            {loading ? "Loading…" : "Load example tasks"}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
