import type { Metadata } from "next";

import { WorkspacePage } from "@/components/tasks/workspace-page";
import { viewMetadata } from "@/lib/site";

export const metadata: Metadata = viewMetadata({
  title: "Today",
  description:
    "Today's planned tasks in Kairos, with anything overdue listed separately so nothing slips.",
  path: "/today",
});

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
