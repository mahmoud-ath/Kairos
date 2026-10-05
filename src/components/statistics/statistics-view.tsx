"use client";

import Link from "next/link";

import { ActivityBarChart } from "@/components/statistics/activity-chart";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { formatMonthDay, startOfWeek } from "@/lib/dates";
import type { ActivityPoint, ScopeCounts } from "@/lib/stats";
import { cn } from "@/lib/utils";

export type CategoryBreakdownRow = {
  id: string | null;
  name: string;
  color: string;
  total: number;
  completed: number;
  remaining: number;
  percentage: number;
};

export type StatisticsViewData = {
  parents: ScopeCounts;
  subtasks: ScopeCounts;
  activity: ActivityPoint[];
  activityTotals: { completed: number; reopened: number };
  categoryBreakdown: CategoryBreakdownRow[];
  windowDays: number;
};

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function StatisticsView({
  data,
  today,
  scopeLabel,
  weekStartsOn,
}: {
  data: StatisticsViewData;
  today: string;
  scopeLabel: string;
  weekStartsOn: number;
}) {
  const { parents, subtasks, activity, activityTotals, categoryBreakdown } = data;
  const maxCategory = categoryBreakdown.reduce((max, row) => Math.max(max, row.total), 0);

  // The configured week start is used for the "this week" summary.
  const weekStart = startOfWeek(today, weekStartsOn);
  const completedThisWeek = activity
    .filter((point) => point.date >= weekStart)
    .reduce((total, point) => total + point.completed, 0);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-6 sm:px-6 lg:py-10">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Statistics</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Current progress for {scopeLabel}, plus the history of what you finished.
          </p>
        </div>

        <nav aria-label="Activity window" className="flex items-center gap-1 rounded-md border border-border p-0.5">
          {[7, 30].map((days) => (
            <Link
              key={days}
              href={`/statistics?range=${days}`}
              aria-current={data.windowDays === days ? "page" : undefined}
              className={cn(
                "rounded px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
                data.windowDays === days && "bg-accent font-medium text-foreground",
              )}
            >
              {days} days
            </Link>
          ))}
        </nav>
      </header>

      <section aria-labelledby="current-heading" className="flex flex-col gap-3">
        <div>
          <h2 id="current-heading" className="text-sm font-semibold">
            Current status
          </h2>
          <p className="text-xs text-muted-foreground">
            Where things stand right now in {scopeLabel}. This is independent of the history below.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Tasks in scope" value={parents.total} />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <StatCard
            label="Completed this week"
            value={completedThisWeek}
            hint={`since ${formatMonthDay(weekStart)} · your week starts on the configured day`}
          />
          <StatCard
            label="Completed in window"
            value={activityTotals.completed}
            hint={`over the last ${data.windowDays} days`}
          />
        </div>
          <StatCard label="Completed" value={parents.completed} />
          <StatCard label="Remaining" value={parents.remaining} />
          <StatCard
            label="Completion"
            value={`${parents.percentage}%`}
            hint="of top-level tasks"
          />
        </div>

        <div className="rounded-lg border border-border px-4 py-3">
          <div className="flex items-baseline justify-between">
            <p className="text-xs text-muted-foreground">Completion progress</p>
            <p className="text-xs tabular-nums text-muted-foreground">
              {parents.completed}/{parents.total}
            </p>
          </div>
          <Progress value={parents.percentage} className="mt-2 h-1.5" />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <StatCard
            label="Subtasks completed"
            value={subtasks.completed}
            hint={`${subtasks.total} subtasks in scope`}
          />
          <StatCard
            label="Subtasks remaining"
            value={subtasks.remaining}
            hint="Subtask progress is tracked separately from tasks"
          />
        </div>
      </section>

      <Separator />

      <section aria-labelledby="activity-heading" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 id="activity-heading" className="text-sm font-semibold">
              Completion activity
            </h2>
            <p className="text-xs text-muted-foreground">
              Tasks completed per day over the last {data.windowDays} days, counted in your
              timezone. Completing and reopening a task does not count twice for the same day.
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            {activityTotals.completed} completed · {activityTotals.reopened} reopened
          </p>
        </div>

        <div className="rounded-lg border border-border bg-card px-3 py-4">
          <ActivityBarChart points={activity} today={today} />
        </div>
      </section>

      <Separator />

      <section aria-labelledby="category-heading" className="flex flex-col gap-3">
        <div>
          <h2 id="category-heading" className="text-sm font-semibold">
            Category breakdown
          </h2>
          <p className="text-xs text-muted-foreground">
            All top-level tasks by category, including uncategorized ones.
          </p>
        </div>

        {categoryBreakdown.length === 0 ? (
          <p className="text-sm text-muted-foreground">No tasks to summarise yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {categoryBreakdown.map((row) => (
              <li
                key={row.id ?? "none"}
                className="rounded-lg border border-border px-4 py-3"
                style={{ minWidth: 0 }}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      aria-hidden="true"
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: row.color }}
                    />
                    <span className="truncate text-sm">{row.name}</span>
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    {row.completed}/{row.total} · {row.percentage}%
                  </span>
                </div>
                <div
                  aria-hidden="true"
                  className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted"
                  style={{ maxWidth: `${maxCategory > 0 ? 100 : 0}%` }}
                >
                  <span
                    className="block h-full rounded-full bg-primary"
                    style={{ width: `${row.percentage}%` }}
                  />
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {row.remaining} remaining
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
