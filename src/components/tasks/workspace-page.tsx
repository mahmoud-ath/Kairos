import { TaskWorkspace } from "@/components/tasks/task-workspace";
import type { WorkspaceProgress } from "@/lib/stats";
import type { ViewScope } from "@/lib/views";
import { getRequestContext } from "@/server/context";
import { ensureHabitInstances } from "@/server/services/habits";
import { getStatistics } from "@/server/services/statistics";
import { listTasks } from "@/server/services/tasks";

/**
 * Renders one task view.
 *
 * Server Component: reads the tasks, the settings and the view's stats on the
 * server, then hands them to the interactive client workspace.
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

  // Generated here as well as in the layout, so this render is guaranteed to see
  // the instances it is about to list (the two may run concurrently).
  if (includeHabitInstances) await ensureHabitInstances(ctx);

  const [tasks, statistics] = await Promise.all([
    listTasks(ctx.userId, { includeHabits: includeHabitInstances }),
    getStatistics(ctx, { scope, windowDays }),
  ]);

  const progress: WorkspaceProgress = {
    parents: statistics.parents,
    subtasks: statistics.subtasks,
    activity: statistics.activity,
    windowDays: statistics.windowDays,
  };

  return (
    <TaskWorkspace
      scope={scope}
      title={title}
      tasks={tasks}
      progress={progress}
      emptyTitle={emptyTitle}
      emptyDescription={emptyDescription}
      showCategory={showCategory}
    />
  );
}
