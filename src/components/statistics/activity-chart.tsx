"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatCompactDate, formatMonthDay } from "@/lib/dates";
import type { ActivityPoint } from "@/lib/stats";

/**
 * Completion activity is *historical*: it comes from recorded events, so a task
 * reopened today still counts on the day it was completed.
 */
function chartData(points: readonly ActivityPoint[], today: string) {
  return points.map((point) => ({
    ...point,
    label: formatMonthDay(point.date),
    shortLabel: formatCompactDate(point.date, today),
  }));
}

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: ActivityPoint & { label: string } }>;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0].payload;
  return (
    <div className="rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs shadow-sm">
      <p className="font-medium">{point.label}</p>
      <p className="text-muted-foreground">{point.completed} completed</p>
      {point.reopened > 0 ? (
        <p className="text-muted-foreground">{point.reopened} reopened</p>
      ) : null}
    </div>
  );
}

/** Small area used inside the progress panel. */
export function MiniActivityChart({
  points,
  today,
  height = 72,
}: {
  points: readonly ActivityPoint[];
  today: string;
  height?: number;
}) {
  const data = chartData(points, today);
  const hasAny = data.some((point) => point.completed > 0 || point.reopened > 0);

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 6, right: 4, bottom: 0, left: 4 }}>
          <Tooltip content={<ChartTooltip />} cursor={false} />
          <Line
            type="monotone"
            dataKey="completed"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
          {hasAny ? null : (
            <Line type="monotone" dataKey="reopened" stroke="transparent" dot={false} />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Full chart for the statistics page. */
export function ActivityBarChart({
  points,
  today,
}: {
  points: readonly ActivityPoint[];
  today: string;
}) {
  const data = chartData(points, today);

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
          <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          />
          <YAxis
            allowDecimals={false}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: "hsl(var(--accent))" }} />
          <Bar dataKey="completed" name="Completed" radius={[3, 3, 0, 0]}>
            {data.map((point) => (
              <Cell key={point.date} fill="hsl(var(--primary))" />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
