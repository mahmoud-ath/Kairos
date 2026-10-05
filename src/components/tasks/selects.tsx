"use client";

import { Check, Tag } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PRIORITIES, PRIORITY_META } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { CategoryDTO, LabelDTO, TaskPriority } from "@/types/kairos";

const NONE_VALUE = "__none__";

export function CategorySelect({
  value,
  onChange,
  categories,
  disabled,
  disabledHint,
  className,
  id,
}: {
  value: string | null;
  onChange: (categoryId: string | null) => void;
  categories: readonly CategoryDTO[];
  disabled?: boolean;
  disabledHint?: string;
  className?: string;
  id?: string;
}) {
  return (
    <Select
      value={value ?? NONE_VALUE}
      onValueChange={(next) => onChange(next === NONE_VALUE ? null : next)}
      disabled={disabled}
    >
      <SelectTrigger id={id} className={cn("h-9", className)} title={disabledHint}>
        <SelectValue placeholder="No category" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE_VALUE}>No category</SelectItem>
        {categories.map((category) => (
          <SelectItem key={category.id} value={category.id}>
            <span className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: category.color }}
              />
              {category.name}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function PrioritySelect({
  value,
  onChange,
  className,
  id,
}: {
  value: TaskPriority;
  onChange: (priority: TaskPriority) => void;
  className?: string;
  id?: string;
}) {
  return (
    <Select value={value} onValueChange={(next) => onChange(next as TaskPriority)}>
      <SelectTrigger id={id} className={cn("h-9", className)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {PRIORITIES.map((priority) => (
          <SelectItem key={priority} value={priority}>
            <span className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className={cn("h-1.5 w-1.5 rounded-full", PRIORITY_META[priority].dot)}
              />
              {PRIORITY_META[priority].label}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function LabelSelect({
  value,
  onChange,
  labels,
  id,
}: {
  value: readonly string[];
  onChange: (labelIds: string[]) => void;
  labels: readonly LabelDTO[];
  id?: string;
}) {
  const selected = new Set(value);

  function toggle(labelId: string) {
    const next = new Set(selected);
    if (next.has(labelId)) next.delete(labelId);
    else next.add(labelId);
    onChange([...next]);
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          id={id}
          className="h-9 w-full justify-start font-normal"
        >
          <Tag className="mr-2 h-4 w-4 text-muted-foreground" />
          {value.length === 0
            ? "No labels"
            : value.length === 1
              ? (labels.find((label) => label.id === value[0])?.name ?? "1 label")
              : `${value.length} labels`}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-1">
        {labels.length === 0 ? (
          <p className="px-2 py-1.5 text-sm text-muted-foreground">
            No labels yet — create them in Settings.
          </p>
        ) : (
          labels.map((label) => {
            const active = selected.has(label.id);
            return (
              <button
                key={label.id}
                type="button"
                role="menuitemcheckbox"
                aria-checked={active}
                onClick={() => toggle(label.id)}
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent"
              >
                <span
                  aria-hidden="true"
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: label.color }}
                />
                <span className="flex-1 truncate">{label.name}</span>
                {active ? <Check className="h-4 w-4 text-primary" /> : null}
              </button>
            );
          })
        )}
      </PopoverContent>
    </Popover>
  );
}

/** Plain date input: date-only values, no timezone surprises. */
export function DateField({
  id,
  label,
  value,
  onChange,
  hint,
}: {
  id: string;
  label: string;
  value: string | null;
  onChange: (value: string | null) => void;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <Label htmlFor={id}>{label}</Label>
        {value ? (
          <button
            type="button"
            className="text-xs text-muted-foreground underline-offset-2 hover:underline"
            onClick={() => onChange(null)}
          >
            Clear
          </button>
        ) : null}
      </div>
      <Input
        id={id}
        type="date"
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value || null)}
        className="h-9"
      />
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
