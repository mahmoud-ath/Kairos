import { TaskWorkspace } from "@/components/tasks/task-workspace";
import { todayDateOnly } from "@/lib/dates";
import type { WorkspaceProgress } from "@/lib/stats";
import type { ViewScope } from "@/lib/views";
import { requireUserId } from "@/server/auth";
import { ensureHabitInstances } from "@/server/services/habits";
import { getStatistics } from "@/server/services/statistics";
import { getSettingsRecord } from "@/server/services/settings";
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
  const userId = await requireUserId();
  const settings = await getSettingsRecord(userId);
  const today = todayDateOnly(settings.timezone);

  // Generated here as well as in the layout, so this render is guaranteed to see
  // the instances it is about to list (the two may run concurrently).
  if (includeHabitInstances) await ensureHabitInstances(userId, today);

  const [tasks, statistics] = await Promise.all([
    listTasks(userId, { includeHabits: includeHabitInstances }),
    getStatistics(userId, { scope, today, timeZone: settings.timezone, windowDays }),
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
