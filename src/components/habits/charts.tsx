"use client";

import dynamic from "next/dynamic";

/**
 * Recharts is the largest client dependency in the app and none of it is needed
 * for the first paint, so the habits page loads it on demand — the same rule the
 * statistics page follows (`components/statistics/charts.tsx`).
 *
 * The placeholder reserves the chart's exact box, which keeps Cumulative Layout
 * Shift at zero while the chunk arrives.
 */
const placeholder = (className: string) => {
  function ChartPlaceholder() {
    return <div className={className} aria-hidden="true" />;
  }
  return ChartPlaceholder;
};

/** Daily completion across every habit, over the last 30 days. */
export const HabitTrendChart = dynamic(
  () => import("@/components/habits/habit-trend-chart").then((module) => module.HabitTrendChart),
  { ssr: false, loading: placeholder("h-56 w-full") },
);
