import type { Metadata } from "next";

import { WorkspacePage } from "@/components/tasks/workspace-page";

export const metadata: Metadata = { title: "Upcoming" };

export default function UpcomingPage() {
  return (
    <WorkspacePage
      scope={{ kind: "upcoming" }}
      title="Upcoming"
      subtitle="Everything planned after today, grouped by day."
      emptyTitle="Nothing scheduled yet"
      emptyDescription="Give a task a planned or due date in the future and it will show up here."
      showCategory
    />
  );
}
