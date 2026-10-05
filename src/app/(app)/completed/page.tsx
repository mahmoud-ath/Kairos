import type { Metadata } from "next";

import { WorkspacePage } from "@/components/tasks/workspace-page";

export const metadata: Metadata = { title: "Completed" };

export default function CompletedPage() {
  return (
    <WorkspacePage
      scope={{ kind: "completed" }}
      title="Completed"
      subtitle="Finished tasks, most recently completed first."
      emptyTitle="Nothing completed yet"
      emptyDescription="Completed tasks move here so the active lists stay focused."
      showCategory
    />
  );
}
