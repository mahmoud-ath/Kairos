"use client";

import { Check } from "lucide-react";
import { useId } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatCompactDate, formatFullMonthDay, formatMonthDay } from "@/lib/dates";
import { habitWeekday, type HabitTrendPoint } from "@/lib/habits";
import { cn } from "@/lib/utils";

type HabitName = { id: string; title: string };

type TrendDatum = HabitTrendPoint & {
  label: string;
  full: string;
  short: string;
  weekend: boolean;
};

function chartData(points: readonly HabitTrendPoint[], today: string): TrendDatum[] {
  return points.map((point) => ({
    ...point,
    label: formatMonthDay(point.date),
    full: formatFullMonthDay(point.date),
    short: formatCompactDate(point.date, today),
    weekend: [0, 6].includes(habitWeekday(point.date)),
  }));
}

/**
 * The hover card: the day, the score, and *which* habits were done.
 *
 * The per-habit list is the point of it — a percentage alone cannot tell you that
 * the walk was kept up and the guitar was not.
 */
function TrendTooltip({
  active,
  payload,
  habits,
}: {
  active?: boolean;
  payload?: Array<{ payload: TrendDatum }>;
  habits: readonly HabitName[];
}) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0].payload;

  return (
    <div className="w-60 rounded-lg border border-border bg-popover p-3 text-xs shadow-lg">
      <div className="flex items-baseline justify-between gap-2">
        <p className="font-medium">{point.full}</p>
        <p className="tabular-nums text-muted-foreground">
          {point.percent === null ? "—" : `${point.percent}%`}
        </p>
      </div>
      <p className="mt-0.5 text-muted-foreground">
        {point.due === 0
          ? "Nothing was due"
          : `${point.done} of ${point.due} ${point.due === 1 ? "habit" : "habits"} done`}
      </p>

      {point.due > 0 ? (
        <ul className="mt-2 flex flex-col gap-1">
          {habits.map((habit) => {
            const due = point.dueIds.includes(habit.id);
            const done = point.doneIds.includes(habit.id);
            return (
              <li
                key={habit.id}
                className={cn("flex items-center gap-1.5", !due && "opacity-45")}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "grid h-3.5 w-3.5 shrink-0 place-items-center rounded-[3px] border",
                    done && "border-primary bg-primary text-primary-foreground",
                    !done && due && "border-destructive/40 bg-destructive/10",
                    !due && "border-transparent bg-muted",
                  )}
                >
                  {done ? <Check className="h-2.5 w-2.5" /> : null}
                </span>
                <span className="truncate">{habit.title}</span>
                {!due ? (
                  <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">
                    not due
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}

      {point.average !== null ? (
        <p className="mt-2 border-t border-border pt-1.5 text-[11px] text-muted-foreground">
          7-day average {point.average}%
        </p>
      ) : null}
    </div>
  );
}

/**
 * How much of each day's habits was finished.
 *
 * Three things carry the meaning:
 *  - the filled area is the day itself, so a single missed day is a notch rather
 *    than a trend;
 *  - the dashed line is the trailing 7-day average, which is the line to actually
 *    read — that is the habit forming or slipping;
 *  - a day with nothing due is a *gap*, never a zero, so a weekend nobody owed
 *    anything on does not read as failure (those days are shaded).
 */
export function HabitTrendChart({
  points,
  habits,
  today,
}: {
  points: readonly HabitTrendPoint[];
  habits: readonly HabitName[];
  today: string;
}) {
  const data = chartData(points, today);
  const gradientId = `habit-trend-${useId().replace(/:/g, "")}`;
  const scored = data.filter((point) => point.percent !== null);
  const overall =
    scored.length === 0
      ? null
      : Math.round(scored.reduce((total, point) => total + (point.percent ?? 0), 0) / scored.length);
  // A long window needs sparser ticks or the labels collide.
  const tickGap = data.length > 45 ? 64 : data.length > 14 ? 40 : 12;

  return (
    <div className="flex flex-col gap-2">
      <div className="h-64 w-full sm:h-72">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
              </linearGradient>
            </defs>

            <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />

            {/* Weekends are shaded so a gap in the line is readable at a glance. */}
            {data
              .filter((point) => point.weekend)
              .map((point) => (
                <ReferenceArea
                  key={point.date}
                  x1={point.label}
                  x2={point.label}
                  fill="hsl(var(--muted-foreground))"
                  fillOpacity={0.07}
                />
              ))}

            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
              minTickGap={tickGap}
              tickMargin={6}
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            />
            <YAxis
              domain={[0, 100]}
              ticks={[0, 25, 50, 75, 100]}
              tickFormatter={(value: number) => `${value}%`}
              tickLine={false}
              axisLine={false}
              width={44}
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            />

            {overall !== null && overall > 0 ? (
              <ReferenceLine
                y={overall}
                stroke="hsl(var(--border))"
                strokeDasharray="2 4"
                label={{
                  value: `average ${overall}%`,
                  position: "insideTopRight",
                  fontSize: 10,
                  fill: "hsl(var(--muted-foreground))",
                }}
              />
            ) : null}

            <Tooltip
              content={<TrendTooltip habits={habits} />}
              cursor={{ stroke: "hsl(var(--border))", strokeDasharray: "3 3" }}
            />

            <Area
              type="monotone"
              dataKey="percent"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              fill={`url(#${gradientId})`}
              dot={{ r: 2.5, fill: "hsl(var(--primary))", strokeWidth: 0 }}
              activeDot={{ r: 5, strokeWidth: 2, stroke: "hsl(var(--background))" }}
              // A day with nothing due is a gap in the line, not a dip to zero.
              connectNulls={false}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="average"
              stroke="hsl(var(--muted-foreground))"
              strokeWidth={2}
              strokeDasharray="5 4"
              dot={false}
              connectNulls
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-[11px] text-muted-foreground">
        <li className="flex items-center gap-1.5">
          <span aria-hidden="true" className="h-0.5 w-5 rounded-full bg-primary" />
          Each day
        </li>
        <li className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="h-0.5 w-5 rounded-full border-t-2 border-dashed border-muted-foreground"
          />
          7-day average
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden="true" className="h-3 w-3 rounded-[3px] bg-muted-foreground/10" />
          Weekend
        </li>
      </ul>
    </div>
  );
}
