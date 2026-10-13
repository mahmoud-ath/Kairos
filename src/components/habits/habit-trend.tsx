"use client";

import { CalendarCheck, Flame, Sparkles, Target } from "lucide-react";
import Link from "next/link";

import { HabitTrendChart } from "@/components/habits/charts";
import { formatFullMonthDay } from "@/lib/dates";
import {
  HABIT_TREND_WINDOWS,
  trendAverage,
  trendBest,
  trendCheckInDays,
  trendPerfectDays,
  type HabitTrendPoint,
  type HabitTrendWindow,
} from "@/lib/habits";
import { cn } from "@/lib/utils";

/**
 * The trend card.
 *
 * Headline numbers first, then the shape of the window, then the caption that
 * explains how to read it — the numbers answer "how am I doing", the chart
 * answers "which way is this going".
 */
export function HabitTrend({
  points,
  habits,
  trendWindow,
  today,
  rangeHref,
}: {
  points: readonly HabitTrendPoint[];
  habits: readonly { id: string; title: string }[];
  trendWindow: HabitTrendWindow;
  today: string;
  /** Link to another window, preserving the rest of the query string. */
  rangeHref: (window: HabitTrendWindow) => string;
}) {
  const checkIns = trendCheckInDays(points);
  const perfect = trendPerfectDays(points);
  const average = trendAverage(points);
  const best = trendBest(points);

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border bg-card px-4 py-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-sm font-semibold">Last {trendWindow} days</h2>
          <p className="text-xs text-muted-foreground">
            {checkIns} of the last {points.length} days{" "}
            {checkIns === 1 ? "has" : "have"} a check-in
          </p>
        </div>

        <div
          role="group"
          aria-label="Trend range"
          className="flex items-center rounded-md border border-border p-0.5"
        >
          {HABIT_TREND_WINDOWS.map((window) => (
            <Link
              key={window}
              href={rangeHref(window)}
              aria-current={window === trendWindow ? "true" : undefined}
              className={cn(
                "rounded px-2 py-1 text-xs transition-colors",
                window === trendWindow
                  ? "bg-accent font-medium text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {window}d
            </Link>
          ))}
        </div>
      </header>

      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat
          icon={<CalendarCheck className="h-3.5 w-3.5" aria-hidden="true" />}
          label="Check-ins"
          value={`${checkIns}`}
          hint={`of ${points.length} days`}
        />
        <Stat
          icon={<Target className="h-3.5 w-3.5" aria-hidden="true" />}
          label="Average"
          value={average === null ? "—" : `${average}%`}
          hint="of what was due"
        />
        <Stat
          icon={<Sparkles className="h-3.5 w-3.5" aria-hidden="true" />}
          label="Perfect days"
          value={`${perfect}`}
          hint="everything done"
        />
        <Stat
          icon={<Flame className="h-3.5 w-3.5" aria-hidden="true" />}
          label="Best day"
          value={best?.percent ? `${best.percent}%` : "—"}
          hint={best ? formatFullMonthDay(best.date) : "nothing yet"}
        />
      </dl>

      {points.some((point) => point.due > 0) ? (
        <HabitTrendChart points={points} habits={habits} today={today} />
      ) : (
        <p className="py-10 text-center text-xs text-muted-foreground">
          Nothing has been due in this window yet.
        </p>
      )}

      <p className="text-xs text-muted-foreground">
        The filled line is each day on its own; the dashed line is the 7-day
        average, which is the one to read for direction. Days with no dot had
        nothing due — a short gap is a rest day, not a missed one.
      </p>
    </section>
  );
}

function Stat({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg border border-border px-3 py-2">
      <dt className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        {icon}
        {label}
      </dt>
      <dd className="text-lg font-semibold tabular-nums leading-tight">{value}</dd>
      <dd className="truncate text-[11px] text-muted-foreground">{hint}</dd>
    </div>
  );
}
