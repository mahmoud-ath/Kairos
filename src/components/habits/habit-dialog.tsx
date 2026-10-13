"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { CategorySelect } from "@/components/tasks/selects";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NOTES_MAX_LENGTH, TITLE_MAX_LENGTH } from "@/lib/constants";
import { EVERY_DAY, WEEKDAY_SHORT, WEEKDAYS, WEEKENDS } from "@/lib/habits";
import { cn } from "@/lib/utils";
import type { CategoryDTO, HabitDTO } from "@/types/kairos";
import { createHabitAction, updateHabitAction } from "@/server/actions/habits";

/** Monday-first, which is how people read a week in this app. */
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

const PRESETS: Array<{ label: string; days: readonly number[] }> = [
  { label: "Every day", days: EVERY_DAY },
  { label: "Weekdays", days: WEEKDAYS },
  { label: "Weekends", days: WEEKENDS },
];

/**
 * Create or edit a habit.
 *
 * This is the *recipe* — the days it is due on, its category and its notes. What
 * the user does from day to day (ticking today's instance off) happens in Today,
 * never here.
 */
export function HabitDialog({
  open,
  onOpenChange,
  habit,
  categories,
  onCreateCategory,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Omitted when creating a new habit. */
  habit?: HabitDTO;
  categories: readonly CategoryDTO[];
  onCreateCategory: (name: string) => Promise<CategoryDTO | null>;
}) {
  const isEdit = Boolean(habit);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [days, setDays] = useState<number[]>([...EVERY_DAY]);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(habit?.title ?? "");
    setNotes(habit?.notes ?? "");
    setDays(habit?.days ?? [...EVERY_DAY]);
    setCategoryId(habit?.categoryId ?? null);
    setError(null);
  }, [open, habit]);

  function toggleDay(day: number) {
    setDays((current) =>
      current.includes(day)
        ? current.filter((value) => value !== day)
        : [...current, day].sort((a, b) => a - b),
    );
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (days.length === 0) {
      setError("Pick at least one day.");
      return;
    }

    setSaving(true);
    setError(null);

    const payload = { title: title.trim(), notes, days, categoryId };
    const result = isEdit
      ? await updateHabitAction({ id: habit!.id, ...payload })
      : await createHabitAction(payload);

    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    toast.success(isEdit ? "Habit updated" : `Habit “${payload.title}” created`);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{isEdit ? "Edit habit" : "New habit"}</DialogTitle>
            <DialogDescription>
              Each day it is due, a task is generated for it in Today. Ticking that
              task off is what marks the habit done.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2">
            <Label htmlFor="habit-title">Title</Label>
            <Input
              id="habit-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={TITLE_MAX_LENGTH}
              autoFocus
              required
              placeholder="Read for 20 minutes"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Days</Label>
            <div className="flex gap-1">
              {DAY_ORDER.map((day) => {
                const active = days.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    aria-pressed={active}
                    aria-label={fullDayLabel(day)}
                    onClick={() => toggleDay(day)}
                    className={cn(
                      "h-8 flex-1 rounded-md border text-xs font-medium transition-colors",
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border text-muted-foreground hover:bg-accent hover:text-foreground",
                    )}
                  >
                    {WEEKDAY_SHORT[day]}
                  </button>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-1">
              {PRESETS.map((preset) => (
                <Button
                  key={preset.label}
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs text-muted-foreground"
                  onClick={() => setDays([...preset.days])}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="habit-category">Category</Label>
            <CategorySelect
              id="habit-category"
              value={categoryId}
              onChange={setCategoryId}
              categories={categories}
              onCreate={onCreateCategory}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="habit-notes">Notes</Label>
            <Textarea
              id="habit-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              maxLength={NOTES_MAX_LENGTH}
              rows={3}
              placeholder="Optional — why this habit matters, or how to do it."
            />
          </div>

          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving || title.trim().length === 0}>
              {saving ? "Saving…" : isEdit ? "Save changes" : "Create habit"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const FULL_DAY_LABELS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function fullDayLabel(day: number): string {
  return FULL_DAY_LABELS[day] ?? String(day);
}
