import { ProgressPanelContent } from "@/components/layout/progress-panel";
import { Skeleton } from "@/components/ui/skeleton";
import { activityRangeForDays, type WorkspaceProgress } from "@/lib/stats";
import type { ViewScope } from "@/lib/views";
import type { RequestContext } from "@/server/context";
import { getStatistics } from "@/server/services/statistics";
import { listTasks } from "@/server/services/tasks";

/**
 * The progress panel's data, rendered behind a Suspense boundary.
 *
 * The task list is what the reader came for, so it must not wait for statistics
 * (a second task read plus the event history). This component streams in after
 * the rows, and `listTasks` is memoised per request, so the list it needs is a
 * cache hit rather than another table scan.
 */
export async function ViewProgress({
  ctx,
  scope,
  title,
  windowDays,
  includeHabitInstances,
  statisticsHref,
}: {
  ctx: RequestContext;
  scope: ViewScope;
  title: string;
  windowDays: number;
  includeHabitInstances: boolean;
  statisticsHref?: string;
}) {
  const tasks = await listTasks(ctx.userId, includeHabitInstances);
  const statistics = await getStatistics(ctx, {
    scope,
    range: activityRangeForDays(ctx.today, windowDays),
    tasks,
  });

  const progress: WorkspaceProgress = {
    parents: statistics.parents,
    subtasks: statistics.subtasks,
    activity: statistics.activity,
    windowDays: statistics.windowDays,
  };

  return (
    <ProgressPanelContent
      title={title}
      progress={progress}
      statisticsHref={statisticsHref}
    />
  );
}

/** Placeholder with the same footprint, so the panel does not jump when it fills. */
export function ProgressSkeleton() {
  return (
    <div className="flex flex-col gap-4 p-4" aria-hidden>
      <Skeleton className="h-3.5 w-20" />
      <div className="flex items-baseline justify-between gap-2">
        <Skeleton className="h-7 w-16" />
        <Skeleton className="h-3 w-24" />
      </div>
      <Skeleton className="h-1.5 w-full" />
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-14" />
        <Skeleton className="h-14" />
      </div>
      <Skeleton className="h-14 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}
