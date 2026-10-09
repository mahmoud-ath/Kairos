import { TaskWorkspace } from "@/components/tasks/task-workspace";
import { todayDateOnly } from "@/lib/dates";
import type { WorkspaceProgress } from "@/lib/stats";
import type { ViewScope } from "@/lib/views";
import { requireUserId } from "@/server/auth";
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
}: {
  scope: ViewScope;
  title: string;
  emptyTitle: string;
  emptyDescription: string;
  showCategory?: boolean;
  windowDays?: number;
}) {
  const userId = await requireUserId();
  const settings = await getSettingsRecord(userId);
  const today = todayDateOnly(settings.timezone);

  const [tasks, statistics] = await Promise.all([
    listTasks(userId),
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
