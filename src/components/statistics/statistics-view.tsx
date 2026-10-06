"use client";

import Link from "next/link";

import { ActivityBarChart } from "@/components/statistics/activity-chart";
import { DonutChart, DonutLegend, type DonutSlice } from "@/components/statistics/donut-chart";
import { Progress } from "@/components/ui/progress";
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
  overdue: number;
  activity: ActivityPoint[];
  activityTotals: { completed: number; reopened: number };
  categoryBreakdown: CategoryBreakdownRow[];
  windowDays: number;
};

const COMPLETED_COLOR = "hsl(var(--primary))";
const REMAINING_COLOR = "hsl(var(--muted-foreground))";

function Tile({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "default" | "primary" | "danger";
}) {
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2.5">
      <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd
        className={cn(
          "mt-1 text-xl font-semibold leading-none tabular-nums",
          tone === "primary" && "text-primary",
          tone === "danger" && "text-destructive",
        )}
      >
        {value}
      </dd>
      {hint ? <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function Card({
  title,
  caption,
  aside,
  children,
  className,
}: {
  title: string;
  caption?: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("flex flex-col rounded-lg border border-border bg-card p-4", className)}>
      <header className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          {caption ? <p className="text-xs text-muted-foreground">{caption}</p> : null}
        </div>
        {aside}
      </header>
      {children}
    </section>
  );
}

/** Rows of the category table, keeping only categories that hold work. */
function openWorkByCategory(rows: readonly CategoryBreakdownRow[]): DonutSlice[] {
  const working = rows.filter((row) => row.remaining > 0).sort((a, b) => b.remaining - a.remaining);
  const top = working.slice(0, 6);
  const rest = working.slice(6);

  const slices: DonutSlice[] = top.map((row) => ({
    name: row.name,
    value: row.remaining,
    color: row.color,
  }));

  if (rest.length > 0) {
    slices.push({
      name: `Other (${rest.length})`,
      value: rest.reduce((sum, row) => sum + row.remaining, 0),
      color: "hsl(var(--muted-foreground))",
    });
  }

  return slices;
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
  const { parents, subtasks, overdue, activity, activityTotals, categoryBreakdown } = data;

  // The configured week start is used for the "this week" figure.
  const weekStart = startOfWeek(today, weekStartsOn);
  const completedThisWeek = activity
    .filter((point) => point.date >= weekStart)
    .reduce((total, point) => total + point.completed, 0);

  const completionSplit: DonutSlice[] = [
    { name: "Completed", value: parents.completed, color: COMPLETED_COLOR },
    { name: "Remaining", value: parents.remaining, color: REMAINING_COLOR },
  ];
  const openSlices = openWorkByCategory(categoryBreakdown);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-6 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Statistics</h1>
          <p className="text-xs text-muted-foreground">
            {scopeLabel} · updated {formatMonthDay(today)}
          </p>
        </div>

        <nav
          aria-label="Activity window"
          className="flex items-center gap-1 rounded-md border border-border p-0.5"
        >
          {[7, 30].map((days) => (
            <Link
              key={days}
              href={`/statistics?range=${days}`}
              aria-current={data.windowDays === days ? "page" : undefined}
              className={cn(
                "rounded px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
                data.windowDays === days && "bg-accent font-medium text-foreground",
              )}
            >
              {days} days
            </Link>
          ))}
        </nav>
      </header>

      {/* Current state ------------------------------------------------------ */}
      <section aria-labelledby="now-heading" className="flex flex-col gap-2">
        <h2 id="now-heading" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Right now
        </h2>
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
          <Tile label="In scope" value={parents.total} />
          <Tile label="Completed" value={parents.completed} tone="primary" />
          <Tile label="Remaining" value={parents.remaining} />
          <Tile
            label="Overdue"
            value={overdue}
            tone={overdue > 0 ? "danger" : "default"}
            hint={parents.total > 0 ? `${Math.round((overdue / parents.total) * 100)}% of scope` : undefined}
          />
          <Tile label="Completion" value={`${parents.percentage}%`} hint="of top-level tasks" />
          <Tile
            label="This week"
            value={completedThisWeek}
            hint={`since ${formatMonthDay(weekStart)}`}
          />
        </dl>
      </section>

      {/* Composition and history -------------------------------------------- */}
      <div className="grid gap-3 lg:grid-cols-5">
        <Card
          title="Completion"
          caption="Finished versus still open"
          className="lg:col-span-2"
        >
          <div className="flex flex-wrap items-center justify-center gap-5">
            <DonutChart
              data={completionSplit}
              centerValue={`${parents.percentage}%`}
              centerLabel="complete"
              emptyLabel="No tasks in scope"
            />
            <DonutLegend data={completionSplit} className="min-w-40 flex-1" />
          </div>

          <div className="mt-4 border-t border-border pt-3">
            <div className="flex items-baseline justify-between text-xs">
              <span className="text-muted-foreground">Subtasks</span>
              <span className="tabular-nums text-muted-foreground">
                {subtasks.completed}/{subtasks.total}
              </span>
            </div>
            <Progress value={subtasks.percentage} className="mt-2 h-1.5" />
          </div>
        </Card>

        <Card
          title="History"
          caption={`Tasks completed per day, in your timezone · last ${data.windowDays} days`}
          className="lg:col-span-3"
          aside={
            <span className="text-xs tabular-nums text-muted-foreground">
              {activityTotals.completed} completed
              {activityTotals.reopened > 0 ? ` · ${activityTotals.reopened} reopened` : ""}
            </span>
          }
        >
          <ActivityBarChart points={activity} today={today} />
          <p className="mt-2 border-t border-border pt-2 text-xs text-muted-foreground">
            Recorded as it happens, so reopening a task today does not remove the day it was
            finished. {completedThisWeek} this week.
          </p>
        </Card>
      </div>

      {/* Categories ---------------------------------------------------------- */}
      <Card
        title="Categories"
        caption="Share of the remaining work, and progress per category"
      >
        {categoryBreakdown.length === 0 ? (
          <p className="text-sm text-muted-foreground">No tasks to summarise yet.</p>
        ) : (
          <div className="grid gap-5 lg:grid-cols-[200px_1fr]">
            <div className="flex flex-col items-center gap-3">
              <DonutChart
                data={openSlices}
                centerValue={String(parents.remaining)}
                centerLabel="open"
                emptyLabel="Nothing open"
                size={148}
              />
              <p className="text-center text-[11px] text-muted-foreground">
                {parents.remaining === 0
                  ? "Everything in scope is done."
                  : `across ${openSlices.length} ${openSlices.length === 1 ? "category" : "categories"}`}
              </p>
            </div>

            <div className="-mx-1 overflow-x-auto">
              <table className="w-full min-w-[28rem] border-collapse text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th scope="col" className="px-1 pb-2 font-medium">
                      Category
                    </th>
                    <th scope="col" className="px-1 pb-2 text-right font-medium">
                      Done
                    </th>
                    <th scope="col" className="w-1/3 px-1 pb-2 font-medium">
                      Progress
                    </th>
                    <th scope="col" className="px-1 pb-2 text-right font-medium">
                      Open
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {categoryBreakdown.map((row) => (
                    <tr key={row.id ?? "none"} className="border-t border-border">
                      <td className="max-w-52 px-1 py-2">
                        <span className="flex min-w-0 items-center gap-2">
                          <span
                            aria-hidden="true"
                            className="h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: row.color }}
                          />
                          <span className="truncate">{row.name}</span>
                        </span>
                      </td>
                      <td className="px-1 py-2 text-right tabular-nums text-muted-foreground">
                        {row.completed}/{row.total}
                      </td>
                      <td className="px-1 py-2">
                        <span className="flex items-center gap-2">
                          <span
                            aria-hidden="true"
                            className="h-1.5 min-w-16 flex-1 overflow-hidden rounded-full bg-muted"
                          >
                            <span
                              className="block h-full rounded-full bg-primary"
                              style={{ width: `${row.percentage}%` }}
                            />
                          </span>
                          <span className="w-10 shrink-0 text-right tabular-nums text-muted-foreground">
                            {row.percentage}%
                          </span>
                        </span>
                      </td>
                      <td
                        className={cn(
                          "px-1 py-2 text-right tabular-nums",
                          row.remaining > 0 ? "text-foreground" : "text-muted-foreground",
                        )}
                      >
                        {row.remaining}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
