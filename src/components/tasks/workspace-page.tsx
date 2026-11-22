import { Suspense } from "react";

import { TaskWorkspace } from "@/components/tasks/task-workspace";
import { ProgressSkeleton, ViewProgress } from "@/components/tasks/view-progress";
import type { ViewScope } from "@/lib/views";
import { getRequestContext } from "@/server/context";
import { ensureHabitInstances } from "@/server/services/habits";
import { listTasks } from "@/server/services/tasks";

/**
 * Renders one task view.
 *
 * Server Component: reads the tasks for the view, then hands them to the
 * interactive client workspace. The progress panel's statistics render behind a
 * Suspense boundary, so the rows paint as soon as the tasks are here instead of
 * waiting for the event history as well.
 */
export async function WorkspacePage({
  scope,
  title,
  emptyTitle,
  emptyDescription,
  showCategory = false,
  windowDays = 7,
  includeHabitInstances = false,
}: {
  scope: ViewScope;
  title: string;
  emptyTitle: string;
  emptyDescription: string;
  showCategory?: boolean;
  windowDays?: number;
  /**
   * Today includes the tasks generated from habits; every other view leaves them
   * out, so they can never surface in All Tasks, Completed or a category.
   */
  includeHabitInstances?: boolean;
}) {
  const ctx = await getRequestContext();

  // The layout runs this too; it is memoised per request, so whichever reaches
  // it first does the work and the other reuses the result — this render is
  // still guaranteed to see the instances it is about to list.
  if (includeHabitInstances) await ensureHabitInstances(ctx);

  const tasks = await listTasks(ctx.userId, includeHabitInstances);

  return (
    <TaskWorkspace
      scope={scope}
      title={title}
      tasks={tasks}
      progressContent={
        <Suspense fallback={<ProgressSkeleton />}>
          <ViewProgress
            ctx={ctx}
            scope={scope}
            title={title}
            windowDays={windowDays}
            includeHabitInstances={includeHabitInstances}
          />
        </Suspense>
      }
      emptyTitle={emptyTitle}
      emptyDescription={emptyDescription}
      showCategory={showCategory}
    />
  );
}
