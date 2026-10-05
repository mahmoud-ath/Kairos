"use client";

import { CalendarClock, CalendarDays, StickyNote } from "lucide-react";

import { formatCompactDate } from "@/lib/dates";
import { cn } from "@/lib/utils";

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

/** Small progress bar plus `2/4` for a task's subtasks. */
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

/** Notes affordance on a row: opens the details panel with notes focused. */
export function NotesButton({
  onClick,
  hasNotes,
  ariaLabel,
}: {
  onClick: () => void;
  hasNotes: boolean;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      title={hasNotes ? "Edit notes" : "Add notes"}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className={cn(
        "grid h-6 w-6 shrink-0 place-items-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
        !hasNotes && "opacity-0 focus-visible:opacity-100 group-hover/row:opacity-100",
      )}
    >
      <StickyNote className="h-3.5 w-3.5" />
    </button>
  );
}
