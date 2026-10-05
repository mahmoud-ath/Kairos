import type { Metadata } from "next";

import { WorkspacePage } from "@/components/tasks/workspace-page";

export const metadata: Metadata = { title: "All Tasks" };

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
