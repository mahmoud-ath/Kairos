"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { cn } from "@/lib/utils";

export type DonutSlice = {
  name: string;
  value: number;
  color: string;
};

function percent(value: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((value / total) * 100);
}

function SliceTooltip({
  active,
  payload,
  total,
}: {
  active?: boolean;
  payload?: Array<{ payload: DonutSlice }>;
  total: number;
}) {
  if (!active || !payload?.length) return null;
  const slice = payload[0].payload;
  return (
    <div className="rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs shadow-sm">
      <p className="font-medium">{slice.name}</p>
      <p className="text-muted-foreground">
        {slice.value} task{slice.value === 1 ? "" : "s"} · {percent(slice.value, total)}%
      </p>
    </div>
  );
}

/**
 * Ring chart for composition — how a total splits into parts.
 *
 * Renders a muted ring with the empty label when there is nothing to show, so a
 * dashboard is never left with a blank hole.
 */
export function DonutChart({
  data,
  centerValue,
  centerLabel,
  size = 168,
  thickness = 22,
  emptyLabel = "Nothing to show",
  className,
}: {
  data: readonly DonutSlice[];
  centerValue?: string;
  centerLabel?: string;
  size?: number;
  thickness?: number;
  emptyLabel?: string;
  className?: string;
}) {
  const slices = data.filter((slice) => slice.value > 0);
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);

  return (
    <div
      className={cn("relative shrink-0", className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={
        total === 0
          ? emptyLabel
          : slices.map((slice) => `${slice.name} ${slice.value}`).join(", ")
      }
    >
      {total === 0 ? (
        <div
          className="absolute inset-0 rounded-full border border-muted-foreground/25"
          style={{ borderWidth: thickness, borderStyle: "solid" }}
        />
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={[...slices]}
              dataKey="value"
              nameKey="name"
              innerRadius={`${Math.round(((size / 2 - thickness) / (size / 2)) * 100)}%`}
              outerRadius="100%"
              paddingAngle={1.5}
              stroke="none"
              isAnimationActive={false}
            >
              {slices.map((slice) => (
                <Cell key={slice.name} fill={slice.color} />
              ))}
            </Pie>
            <Tooltip content={<SliceTooltip total={total} />} cursor={false} />
          </PieChart>
        </ResponsiveContainer>
      )}

      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-semibold tabular-nums">
          {centerValue ?? (total > 0 ? total : "–")}
        </span>
        {centerLabel ? (
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
            {centerLabel}
          </span>
        ) : null}
      </div>
    </div>
  );
}

/** Colour key for a donut: name, value and share. */
export function DonutLegend({
  data,
  className,
}: {
  data: readonly DonutSlice[];
  className?: string;
}) {
  const total = data.reduce((sum, slice) => sum + slice.value, 0);
  if (total === 0) return null;

  return (
    <ul className={cn("flex flex-col gap-1.5 text-sm", className)}>
      {data
        .filter((slice) => slice.value > 0)
        .map((slice) => (
          <li key={slice.name} className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: slice.color }}
            />
            <span className="min-w-0 flex-1 truncate">{slice.name}</span>
            <span className="shrink-0 tabular-nums text-muted-foreground">
              {slice.value} · {percent(slice.value, total)}%
            </span>
          </li>
        ))}
    </ul>
  );
}
