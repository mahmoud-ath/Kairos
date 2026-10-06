import type { Metadata } from "next";

import { WorkspacePage } from "@/components/tasks/workspace-page";
import { viewMetadata } from "@/lib/site";

export const metadata: Metadata = viewMetadata({
  title: "Completed",
  description:
    "Finished tasks in Kairos, newest first, with one-click clearing and undo for accidental deletions.",
  path: "/completed",
});

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
