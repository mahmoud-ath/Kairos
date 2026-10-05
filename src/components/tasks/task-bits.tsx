"use client";

import { CalendarClock, CalendarDays, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PRIORITY_META } from "@/lib/constants";
import { formatCompactDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { isTaskOverdue } from "@/lib/views";
import type { LabelDTO, TaskPriority, TaskStatus } from "@/types/kairos";

/** Small colored dot plus label used for priorities. */
export function PriorityIndicator({ priority }: { priority: TaskPriority }) {
  if (priority === "NONE") return null;
  const meta = PRIORITY_META[priority];
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs", meta.className)}>
      <span aria-hidden="true" className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
      <span className="sr-only sm:not-sr-only">{meta.short}</span>
    </span>
  );
}

export function LabelChips({
  labels,
  max = 3,
}: {
  labels: readonly LabelDTO[];
  max?: number;
}) {
  if (labels.length === 0) return null;
  const visible = labels.slice(0, max);
  const hidden = labels.length - visible.length;

  return (
    <span className="inline-flex items-center gap-1">
      {visible.map((label) => (
        <Badge
          key={label.id}
          variant="outline"
          className="h-5 gap-1 border-border px-1.5 text-[11px] font-normal text-muted-foreground"
        >
          <span
            aria-hidden="true"
            className="h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: label.color }}
          />
          {label.name}
        </Badge>
      ))}
      {hidden > 0 ? (
        <span className="text-[11px] text-muted-foreground">+{hidden}</span>
      ) : null}
    </span>
  );
}

export function DateChip({
  date,
  today,
  kind,
  overdue,
}: {
  date: string;
  today: string;
  kind: "scheduled" | "due";
  overdue?: boolean;
}) {
  const Icon = kind === "scheduled" ? CalendarDays : CalendarClock;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs text-muted-foreground",
        overdue && "font-medium text-destructive",
      )}
      title={kind === "scheduled" ? `Planned for ${date}` : `Due ${date}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {kind === "due" ? "Due " : ""}
      {formatCompactDate(date, today)}
    </span>
  );
}

export function SubtaskProgressLabel({
  done,
  total,
}: {
  done: number;
  total: number;
}) {
  return (
    <span
      aria-label={`${done} of ${total} subtasks completed`}
      className="inline-flex items-center gap-1 text-xs tabular-nums text-muted-foreground"
    >
      <span
        aria-hidden="true"
        className="relative block h-1.5 w-10 overflow-hidden rounded-full bg-muted"
      >
        <span
          className="absolute inset-y-0 left-0 bg-primary"
          style={{ width: `${total === 0 ? 0 : Math.round((done / total) * 100)}%` }}
        />
      </span>
      {`${done}/${total}`}
    </span>
  );
}

export function StatusDot({ status }: { status: TaskStatus }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "h-1.5 w-1.5 rounded-full",
        status === "DONE" ? "bg-emerald-600 dark:bg-emerald-400" : "bg-muted-foreground/40",
      )}
    />
  );
}

/** Clear button used next to optional date inputs. */
export function ClearButton({
  onClick,
  label,
}: {
  onClick: () => void;
  label: string;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-7 w-7 shrink-0 text-muted-foreground"
      aria-label={label}
      onClick={onClick}
    >
      <X className="h-3.5 w-3.5" />
    </Button>
  );
}

export { isTaskOverdue };
