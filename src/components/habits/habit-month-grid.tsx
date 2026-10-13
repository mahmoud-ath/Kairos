"use client";

import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useMemo,
  useOptimistic,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";
import { toast } from "sonner";

import { useAppData } from "@/components/app-data";
import { Button } from "@/components/ui/button";
import {
  addDays,
  compareDateOnly,
  formatFullMonthDay,
  startOfMonth,
  startOfWeek,
} from "@/lib/dates";
import {
  WEEKDAY_TWO_LETTER,
  habitWeekday,
  type HabitDay,
} from "@/lib/habits";
import { cn } from "@/lib/utils";
import type { HabitDTO, HabitMonth, HabitProgress } from "@/types/kairos";
import { setHabitDayAction } from "@/server/actions/habits";

/** How a single day reads. One state, one look — see `CELL_CLASS`. */
type DayState = "done" | "missed" | "today" | "upcoming" | "not-due";

const STATE_LABEL: Record<DayState, string> = {
  done: "Completed",
  missed: "Missed",
  today: "Still to do today",
  upcoming: "Upcoming",
  "not-due": "Not scheduled",
};

/**
 * The single source of truth for how a day looks.
 *
 * The legend and the grid cells both read this map, so a state can never be red
 * in the legend and neutral in the grid.
 */
const CELL_CLASS: Record<DayState, string> = {
  done: "border-primary bg-primary text-primary-foreground",
  missed:
    "border-destructive/40 bg-destructive/10 text-destructive/70 hover:border-destructive/70 hover:bg-destructive/20",
  today: "border-dashed border-primary bg-primary/10 text-primary hover:bg-primary/20",
  upcoming: "border-dashed border-border bg-transparent text-transparent",
  "not-due": "border-transparent bg-muted/80 text-transparent",
};

/** Only these can be changed by hand; everything else is read-only. */
const EDITABLE_STATES: ReadonlySet<DayState> = new Set<DayState>(["done", "missed", "today"]);

function dayState(day: HabitDay, today: string): DayState {
  if (!day.due) return "not-due";
  if (day.done) return "done";
  const comparison = compareDateOnly(day.date, today);
  if (comparison === 0) return "today";
  return comparison > 0 ? "upcoming" : "missed";
}

type DayAction = { habitId: string; date: string; done: boolean };

function applyDayAction(
  grid: Record<string, HabitDay[]>,
  action: DayAction,
): Record<string, HabitDay[]> {
  const days = grid[action.habitId];
  if (!days) return grid;
  return {
    ...grid,
    [action.habitId]: days.map((day) =>
      day.date === action.date ? { ...day, done: action.done } : day,
    ),
  };
}

/** True from `lg` up. The server snapshot is `false`, so SSR renders the week. */
function useIsWide(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia("(min-width: 1024px)");
      query.addEventListener("change", onChange);
      return () => query.removeEventListener("change", onChange);
    },
    () => window.matchMedia("(min-width: 1024px)").matches,
    () => false,
  );
}

type Tooltip = { title: string; date: string; state: string; x: number; y: number };

type ShowTooltip = (
  event: React.MouseEvent<HTMLElement> | React.FocusEvent<HTMLElement>,
  habit: HabitDTO,
  day: HabitDay,
) => void;

/**
 * The grid — one row per habit, one cell per day.
 *
 * This is the second place a habit's day can be given a status (Today is the
 * first), and it exists because days get forgotten: tapping a cell ticks that day
 * off, creating the missed day's task behind the scenes, and tapping again takes
 * it back. Only a due day that has already happened is tappable — the same rule
 * the server enforces.
 *
 * Wide screens get the whole month; narrow ones get one week at a time with
 * 44px targets, because a 24px cell is the smallest a finger can hit and not a
 * comfortable one. Both views are rendered and chosen with CSS, so the
 * responsive default needs no JavaScript and nothing shifts after hydration.
 */
export function HabitMonthGrid({
  habits,
  grid,
  month,
  today,
  progress,
  monthHref,
  thisMonthHref,
}: {
  /** Tracked habits, in display order (paused ones are left out by the page). */
  habits: readonly HabitDTO[];
  /** Per habit, the displayed month's days. */
  grid: Record<string, HabitDay[]>;
  month: HabitMonth;
  today: string;
  progress: Record<string, HabitProgress>;
  /** Link to another month, preserving the rest of the query string. */
  monthHref: (monthFirst: string) => string;
  /** Link back to the account's current month. */
  thisMonthHref: string;
}) {
  const router = useRouter();
  const { settings } = useAppData();
  const [, startTransition] = useTransition();
  const [optimisticGrid, applyOptimistic] = useOptimistic(grid, applyDayAction);
  const [explicitView, setExplicitView] = useState<"week" | "month" | null>(null);
  const [tooltip, setTooltip] = useState<Tooltip | null>(null);
  const isWide = useIsWide();

  const weekStartsOn = settings.weekStartsOn;
  const activeView = explicitView ?? (isWide ? "month" : "week");

  /** Every week that overlaps the displayed month, oldest first. */
  const weeks = useMemo(() => {
    const lastDay = month.days[month.days.length - 1];
    const out: string[] = [];
    for (
      let cursor = startOfWeek(month.days[0], weekStartsOn);
      compareDateOnly(cursor, lastDay) <= 0;
      cursor = addDays(cursor, 7)
    ) {
      out.push(cursor);
    }
    return out;
  }, [month.days, weekStartsOn]);

  const thisWeek = startOfWeek(today, weekStartsOn);
  const indexOfThisWeek = weeks.indexOf(thisWeek);
  // `null` means "the week we are in", falling back to the month's most recent
  // week when today is not part of the displayed month.
  const [weekIndex, setWeekIndex] = useState<number | null>(null);
  const activeWeekIndex =
    weekIndex === null
      ? indexOfThisWeek === -1
        ? weeks.length - 1
        : indexOfThisWeek
      : Math.min(weekIndex, weeks.length - 1);
  const activeWeek = weeks[activeWeekIndex] ?? weeks[0];
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(activeWeek, index)),
    [activeWeek],
  );

  const isCurrentMonth = compareDateOnly(startOfMonth(today), month.first) === 0;
  const isCurrentWeek = activeWeek === thisWeek;
  const canStepBack =
    activeView === "week" ? activeWeekIndex > 0 || month.canGoPrevious : month.canGoPrevious;
  const canStepForward =
    activeView === "week"
      ? activeWeekIndex < weeks.length - 1 || month.canGoNext
      : month.canGoNext;

  function toggle(habit: HabitDTO, date: string, done: boolean) {
    startTransition(async () => {
      applyOptimistic({ habitId: habit.id, date, done });
      const result = await setHabitDayAction({ habitId: habit.id, date, done });
      if (!result.ok) {
        toast.error("Couldn't update that day", { description: result.error });
        return;
      }
      router.refresh();
    });
  }

  const showTooltip: ShowTooltip = (event, habit, day) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setTooltip({
      title: habit.title,
      date: formatFullMonthDay(day.date),
      state: STATE_LABEL[dayState(day, today)],
      // Keep the card on screen when the cell sits near an edge.
      x: Math.min(Math.max(rect.left + rect.width / 2, 96), window.innerWidth - 96),
      y: rect.top,
    });
  };

  /** Step one week; crossing the month's edge moves the month with it. */
  function goWeek(direction: -1 | 1) {
    const next = activeWeekIndex + direction;
    if (next < 0) {
      setWeekIndex(null); // lands on the previous month's most recent week
      router.push(monthHref(addDays(month.first, -1)));
      return;
    }
    if (next >= weeks.length) {
      setWeekIndex(0); // lands on the next month's first week
      router.push(monthHref(addDays(month.days[month.days.length - 1], 1)));
      return;
    }
    setWeekIndex(next);
  }

  function goPeriod(direction: -1 | 1) {
    if (activeView === "week") {
      goWeek(direction);
      return;
    }
    setWeekIndex(null);
    router.push(
      monthHref(
        direction < 0
          ? addDays(month.first, -1)
          : addDays(month.days[month.days.length - 1], 1),
      ),
    );
  }

  const periodLabel = activeView === "week" ? weekLabel(weekDays) : month.label;

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border bg-card px-4 py-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-sm font-semibold">Monthly grid</h2>
          <p className="text-xs text-muted-foreground">
            Tap a cell to mark that day done, or to take it back.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            role="group"
            aria-label="Grid view"
            className="flex items-center rounded-md border border-border p-0.5"
          >
            {(["week", "month"] as const).map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={activeView === option}
                onClick={() => setExplicitView(option)}
                className={cn(
                  "rounded px-2 py-1 text-xs transition-colors",
                  activeView === option
                    ? "bg-accent font-medium text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {option === "week" ? "Week" : "Month"}
              </button>
            ))}
          </div>

          <nav className="flex items-center gap-1" aria-label="Period">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              disabled={!canStepBack}
              aria-label={activeView === "week" ? "Previous week" : "Previous month"}
              onClick={() => goPeriod(-1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-32 text-center text-xs font-medium tabular-nums">
              {periodLabel}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              disabled={!canStepForward}
              aria-label={activeView === "week" ? "Next week" : "Next month"}
              onClick={() => goPeriod(1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </nav>

          {!isCurrentMonth || (activeView === "week" && !isCurrentWeek) ? (
            <Button variant="outline" size="sm" className="h-7 text-xs" asChild>
              <Link href={thisMonthHref} onClick={() => setWeekIndex(null)}>
                This month
              </Link>
            </Button>
          ) : null}
        </div>
      </header>

      {(explicitView === null || explicitView === "month") && (
        <div className={cn("overflow-x-auto pb-1", explicitView === null && "hidden lg:block")}>
          <table className="w-full border-separate border-spacing-[2px]">
            <caption className="sr-only">
              Completion grid for {month.label}. Each row is a habit, each column a day.
            </caption>
            <thead>
              <tr>
                <th scope="col" className="sticky left-0 z-10 bg-card" />
                {month.days.map((date) => (
                  <th
                    key={date}
                    scope="col"
                    aria-label={date}
                    className={cn(
                      "rounded-sm bg-card p-0 align-bottom font-normal",
                      // The today column is highlighted in the heading too.
                      date === today && "bg-primary/10",
                    )}
                  >
                    <span
                      className={cn(
                        "flex flex-col items-center leading-tight text-[10px]",
                        date === today ? "text-foreground" : "text-muted-foreground",
                      )}
                    >
                      <span aria-hidden="true">{WEEKDAY_TWO_LETTER[habitWeekday(date)]}</span>
                      <span
                        aria-hidden="true"
                        className={cn("tabular-nums", date === today && "font-semibold")}
                      >
                        {Number(date.slice(8))}
                      </span>
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {habits.map((habit) => (
                <tr key={habit.id}>
                  <th
                    scope="row"
                    className="sticky left-0 z-10 max-w-36 bg-card pr-2 text-left text-xs font-normal"
                  >
                    <span className="block max-w-36 truncate" title={habit.title}>
                      {habit.title}
                    </span>
                  </th>
                  {(optimisticGrid[habit.id] ?? []).map((day) => (
                    <td key={day.date} className="p-0">
                      <DayMark
                        habit={habit}
                        day={day}
                        today={today}
                        size="month"
                        onToggle={toggle}
                        onShow={showTooltip}
                        onHide={() => setTooltip(null)}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(explicitView === null || explicitView === "week") && (
        <div className={cn("flex flex-col gap-4", explicitView === null && "lg:hidden")}>
          <div className="grid grid-cols-7 gap-1.5">
            {weekDays.map((date) => (
              <div
                key={date}
                aria-label={date}
                className={cn(
                  "flex flex-col items-center rounded-md py-1 text-[11px]",
                  date === today ? "bg-primary/10 text-foreground" : "text-muted-foreground",
                )}
              >
                <span aria-hidden="true">{WEEKDAY_TWO_LETTER[habitWeekday(date)]}</span>
                <span
                  aria-hidden="true"
                  className={cn("tabular-nums", date === today && "font-semibold")}
                >
                  {Number(date.slice(8))}
                </span>
              </div>
            ))}
          </div>

          {habits.map((habit) => {
            const streak = progress[habit.id]?.streak ?? 0;
            const days = optimisticGrid[habit.id] ?? [];
            return (
              <div key={habit.id} className="flex flex-col gap-2">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-xs font-medium">{habit.title}</span>
                  {streak > 0 ? (
                    <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                      {streak} day streak
                    </span>
                  ) : null}
                </div>
                <div className="grid grid-cols-7 gap-1.5">
                  {weekDays.map((date) => {
                    const day =
                      days.find((candidate) => candidate.date === date) ?? {
                        date,
                        due: false,
                        done: false,
                      };
                    return (
                      <DayMark
                        key={date}
                        habit={habit}
                        day={day}
                        today={today}
                        size="week"
                        onToggle={toggle}
                        onShow={showTooltip}
                        onHide={() => setTooltip(null)}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-[11px] text-muted-foreground">
        <LegendItem state="done" label={STATE_LABEL.done} icon />
        <LegendItem state="today" label="Today" />
        <LegendItem state="missed" label={STATE_LABEL.missed} />
        <LegendItem state="upcoming" label={STATE_LABEL.upcoming} />
        <LegendItem state="not-due" label={STATE_LABEL["not-due"]} />
      </ul>

      {tooltip ? (
        <div
          role="tooltip"
          style={{ left: tooltip.x, top: tooltip.y - 10 }}
          className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-full rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs shadow-md"
        >
          <p className="font-medium">{tooltip.title}</p>
          <p className="text-muted-foreground">
            {tooltip.date} · {tooltip.state}
          </p>
        </div>
      ) : null}
    </section>
  );
}

/** "October 12 – 18", naming the month too when the week straddles two. */
function weekLabel(days: readonly string[]): string {
  const first = days[0];
  const last = days[days.length - 1];
  const crosses = first.slice(0, 7) !== last.slice(0, 7);
  const end = crosses ? formatFullMonthDay(last) : String(Number(last.slice(8)));
  return `${formatFullMonthDay(first)} – ${end}`;
}

/**
 * One day. Rendered inside a table cell in the month view and directly inside the
 * seven-column grid in the week view, so the markup stays valid in both.
 */
function DayMark({
  habit,
  day,
  today,
  size,
  onToggle,
  onShow,
  onHide,
}: {
  habit: HabitDTO;
  day: HabitDay;
  today: string;
  size: "month" | "week";
  onToggle: (habit: HabitDTO, date: string, done: boolean) => void;
  onShow: ShowTooltip;
  onHide: () => void;
}) {
  const state = dayState(day, today);
  const editable = EDITABLE_STATES.has(state);
  const isTodayColumn = day.date === today;

  const shape = cn(
    size === "week"
      ? "grid h-11 w-full place-items-center rounded-md border"
      : "grid h-6 w-6 place-items-center rounded-[3px] border",
    "transition-colors",
    CELL_CLASS[state],
    // The highlight belongs to the column, so it survives a completed cell.
    isTodayColumn && size === "month" && "ring-1 ring-primary/25",
  );

  const check = (
    <Check
      className={cn(
        size === "week" ? "h-5 w-5" : "h-3.5 w-3.5",
        // A faint tick on an open day hints that the cell is tappable.
        state === "done" ? "opacity-100" : "opacity-0",
        state === "today" && "opacity-40",
      )}
      aria-hidden="true"
    />
  );

  if (!editable) {
    return (
      <span aria-hidden="true" onMouseEnter={(event) => onShow(event, habit, day)} onMouseLeave={onHide} className={shape}>
        {check}
      </span>
    );
  }

  return (
    <button
      type="button"
      aria-pressed={day.done}
      aria-label={`${day.done ? "Take back" : "Mark done"} ${habit.title} on ${formatFullMonthDay(day.date)}`}
      onClick={() => onToggle(habit, day.date, !day.done)}
      onMouseEnter={(event) => onShow(event, habit, day)}
      onMouseLeave={onHide}
      onFocus={(event) => onShow(event, habit, day)}
      onBlur={onHide}
      className={cn(shape, "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring")}
    >
      {check}
    </button>
  );
}

function LegendItem({
  state,
  label,
  icon = false,
}: {
  state: DayState;
  label: string;
  icon?: boolean;
}) {
  return (
    <li className="flex items-center gap-1.5">
      <span
        aria-hidden="true"
        className={cn(
          "grid h-3.5 w-3.5 place-items-center rounded-[3px] border",
          // Same map as the cells, minus the hover feedback.
          CELL_CLASS[state].replace(/hover:[^\s]+/g, ""),
        )}
      >
        {icon ? <Check className="h-2.5 w-2.5 text-primary-foreground" /> : null}
      </span>
      {label}
    </li>
  );
}
