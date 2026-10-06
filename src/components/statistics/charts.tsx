"use client";

import dynamic from "next/dynamic";

/**
 * Recharts is the largest client dependency in the app and none of it is needed
 * for the first paint, so every chart is loaded on demand: task views never ship
 * it, and the statistics page streams it in after hydration.
 *
 * Each placeholder reserves the exact box of the chart it replaces, which keeps
 * Cumulative Layout Shift at zero while the chunk arrives.
 */
const placeholder = (className: string) => {
  function ChartPlaceholder() {
    return <div className={className} aria-hidden="true" />;
  }
  return ChartPlaceholder;
};

/** Line chart inside the progress panel (every task view). */
export const MiniActivityChart = dynamic(
  () =>
    import("@/components/statistics/activity-chart").then((module) => module.MiniActivityChart),
  { ssr: false, loading: placeholder("h-[72px] w-full") },
);

/** Completions per day on the statistics page. */
export const ActivityBarChart = dynamic(
  () =>
    import("@/components/statistics/activity-chart").then((module) => module.ActivityBarChart),
  { ssr: false, loading: placeholder("h-56 w-full") },
);

/** Composition ring (completion split, open work per category). */
export const DonutChart = dynamic(
  () => import("@/components/statistics/donut-chart").then((module) => module.DonutChart),
  { ssr: false, loading: placeholder("h-[168px] w-[168px] shrink-0") },
);

/** Colour key that ships with the ring. */
export const DonutLegend = dynamic(
  () => import("@/components/statistics/donut-chart").then((module) => module.DonutLegend),
  { ssr: false, loading: placeholder("h-16 w-full") },
);
