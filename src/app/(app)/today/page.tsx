import type { Metadata } from "next";

import { WorkspacePage } from "@/components/tasks/workspace-page";

export const metadata: Metadata = { title: "Today" };

export default function TodayPage() {
  return (
    <WorkspacePage
      scope={{ kind: "today" }}
      title="Today"
      subtitle="What you planned for today, plus anything overdue."
      emptyTitle="Nothing planned for today"
      emptyDescription="Add a task above — in this view it is scheduled for today automatically."
    />
  );
}
