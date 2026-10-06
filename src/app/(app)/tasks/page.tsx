import type { Metadata } from "next";

import { WorkspacePage } from "@/components/tasks/workspace-page";
import { viewMetadata } from "@/lib/site";

export const metadata: Metadata = viewMetadata({
  title: "All Tasks",
  description:
    "Every task in Kairos grouped by its planned day — past days, today, the future, unscheduled work and completed items.",
  path: "/tasks",
});

export default function AllTasksPage() {
  return (
    <WorkspacePage
      scope={{ kind: "all" }}
      title="All Tasks"
      subtitle="Every top-level task, grouped by when it is due."
      emptyTitle="No tasks yet"
      emptyDescription="Create your first task above, or load a few examples to see how Kairos works."
      showCategory
    />
  );
}
