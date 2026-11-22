import type { Metadata } from "next";

import { StatisticsView } from "@/components/statistics/statistics-view";
import { resolveActivityRange } from "@/lib/stats";
import { viewMetadata } from "@/lib/site";
import { getRequestContext } from "@/server/context";
import { getStatistics } from "@/server/services/statistics";

export const metadata: Metadata = viewMetadata({
  title: "Statistics",
  description:
    "Completion analytics for your Kairos workspace: current counts, a completion donut and daily activity for a 7, 30 or 90 day window, or any range you pick.",
  path: "/statistics",
});

export default async function StatisticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  const params = await searchParams;

  const ctx = await getRequestContext();

  // The window comes from the URL, so it is clamped rather than trusted:
  // presets are 7/30/90, a custom range is capped and never reaches the future.
  const range = resolveActivityRange(params, ctx.today);

  const statistics = await getStatistics(ctx, {
    scope: { kind: "all" },
    range,
  });

  return (
    <StatisticsView
      data={{
        parents: statistics.parents,
        subtasks: statistics.subtasks,
        activity: statistics.activity,
        activityTotals: statistics.activityTotals,
        completedThisWeek: statistics.completedThisWeek,
        categoryBreakdown: statistics.categoryBreakdown,
        range: statistics.range,
      }}
      today={ctx.today}
      scopeLabel="all tasks"
      weekStartsOn={ctx.settings.weekStartsOn}
    />
  );
}
