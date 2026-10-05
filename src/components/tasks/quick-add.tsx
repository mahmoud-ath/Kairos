"use client";

import { Plus } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PrioritySelect } from "@/components/tasks/selects";
import { TITLE_MAX_LENGTH } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { ActionResult, CategoryDTO, TaskDTO, TaskPriority } from "@/types/kairos";

export type QuickAddValues = {
  title: string;
  priority: TaskPriority;
  scheduledDate: string | null;
  categoryId: string | null;
};

/**
 * Press Enter to create a task.
 *
 * The view supplies the defaults: a category page defaults to that category and
 * Today defaults the planned date to today.
 */
export function QuickAdd({
  categories,
  defaultCategoryId,
  defaultScheduledDate,
  onSubmit,
  className,
}: {
  categories: readonly CategoryDTO[];
  defaultCategoryId: string | null;
  defaultScheduledDate: string | null;
  onSubmit: (values: QuickAddValues) => Promise<ActionResult<TaskDTO>>;
  className?: string;
}) {
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("NONE");
  const [scheduledDate, setScheduledDate] = useState<string | null>(defaultScheduledDate);
  const [categoryId, setCategoryId] = useState<string | null>(defaultCategoryId);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Keep the per-view defaults when navigating between views.
  useEffect(() => {
    setScheduledDate(defaultScheduledDate);
    setCategoryId(defaultCategoryId);
  }, [defaultScheduledDate, defaultCategoryId]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;

    setSaving(true);
    setError(null);
    const result = await onSubmit({ title: trimmed, priority, scheduledDate, categoryId });
    setSaving(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    // Reset only what should not carry over to the next task.
    setTitle("");
    setPriority("NONE");
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card px-2 py-2 shadow-sm",
        className,
      )}
    >
      <Plus className="ml-1 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <Input
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="Add a task…"
        aria-label="New task title"
        maxLength={TITLE_MAX_LENGTH}
        className="h-8 min-w-40 flex-1 border-0 bg-transparent px-1 shadow-none focus-visible:ring-0"
      />

      <div className="flex flex-wrap items-center gap-2">
        <PrioritySelect
          value={priority}
          onChange={setPriority}
          className="h-8 w-32 text-xs"
        />

        <Input
          type="date"
          value={scheduledDate ?? ""}
          aria-label="Planned date"
          title="Planned date"
          onChange={(event) => setScheduledDate(event.target.value || null)}
          className="h-8 w-36 text-xs"
        />

        <select
          aria-label="Category"
          value={categoryId ?? ""}
          onChange={(event) => setCategoryId(event.target.value || null)}
          className="h-8 max-w-40 rounded-md border border-input bg-background px-2 text-xs text-foreground"
        >
          <option value="">No category</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>

        <Button type="submit" size="sm" className="h-8" disabled={saving || !title.trim()}>
          Add
        </Button>
      </div>

      {error ? (
        <p role="alert" className="w-full px-1 text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </form>
  );
}
