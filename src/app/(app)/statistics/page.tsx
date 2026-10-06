import type { Metadata } from "next";

import { StatisticsView } from "@/components/statistics/statistics-view";
import { isValidActivityWindow } from "@/lib/stats";
import { todayDateOnly } from "@/lib/dates";
import { viewMetadata } from "@/lib/site";
import { getStatistics } from "@/server/services/statistics";
import { getSettingsRecord } from "@/server/services/settings";

export const metadata: Metadata = viewMetadata({
  title: "Statistics",
  description:
    "Completion analytics for your Kairos workspace: current counts, a completion donut and daily activity for the last 7 or 30 days.",
  path: "/statistics",
});

export default async function StatisticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const params = await searchParams;
  const requested = Number(params.range ?? 7);
  const windowDays = isValidActivityWindow(requested) ? requested : 7;

  const settings = await getSettingsRecord();
  const today = todayDateOnly(settings.timezone);

  const statistics = await getStatistics({
    scope: { kind: "all" },
    today,
    timeZone: settings.timezone,
    windowDays,
  });

  return (
    <StatisticsView
      data={{
        parents: statistics.parents,
        subtasks: statistics.subtasks,
        activity: statistics.activity,
        activityTotals: statistics.activityTotals,
        categoryBreakdown: statistics.categoryBreakdown,
        windowDays: statistics.windowDays,
      }}
      today={today}
      scopeLabel="all tasks"
      weekStartsOn={settings.weekStartsOn}
    />
  );
}
