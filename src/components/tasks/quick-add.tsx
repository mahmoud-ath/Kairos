"use client";

import { Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { CategorySelect } from "@/components/tasks/selects";
import { Input } from "@/components/ui/input";
import { TITLE_MAX_LENGTH } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { ActionResult, CategoryDTO, TaskDTO } from "@/types/kairos";

export type QuickAddValues = {
  title: string;
  scheduledDate: string | null;
  categoryId: string | null;
};

/**
 * Press Enter to create a task — there is no button.
 *
 * The view supplies the defaults: a category page defaults to that category and
 * Today defaults the planned date to today.
 */
export function QuickAdd({
  categories,
  defaultCategoryId,
  defaultScheduledDate,
  onSubmit,
  onCreateCategory,
  className,
}: {
  categories: readonly CategoryDTO[];
  defaultCategoryId: string | null;
  defaultScheduledDate: string | null;
  onSubmit: (values: QuickAddValues) => Promise<ActionResult<TaskDTO>>;
  onCreateCategory: (name: string) => Promise<CategoryDTO | null>;
  className?: string;
}) {
  const [title, setTitle] = useState("");
  const [scheduledDate, setScheduledDate] = useState<string | null>(defaultScheduledDate);
  const [categoryId, setCategoryId] = useState<string | null>(defaultCategoryId);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

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
    const result = await onSubmit({ title: trimmed, scheduledDate, categoryId });
    setSaving(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    setTitle("");
    inputRef.current?.focus();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-2.5 shadow-sm",
        className,
      )}
    >
      <Plus className="ml-1 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <Input
        ref={inputRef}
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="Add a task and press Enter…"
        aria-label="New task title"
        maxLength={TITLE_MAX_LENGTH}
        className={cn(
          "h-9 min-w-40 flex-1 border-0 bg-transparent px-1 shadow-none focus-visible:ring-0",
          saving && "opacity-60",
        )}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Input
          type="date"
          value={scheduledDate ?? ""}
          aria-label="Planned date"
          title="Planned date"
          onChange={(event) => setScheduledDate(event.target.value || null)}
          className="h-9 w-40 text-xs"
        />

        <CategorySelect
          compact
          value={categoryId}
          onChange={setCategoryId}
          categories={categories}
          onCreate={onCreateCategory}
          className="h-9 max-w-44"
        />
      </div>

      {error ? (
        <p role="alert" className="w-full px-1 text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </form>
  );
}
