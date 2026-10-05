import type { Metadata } from "next";

import { WorkspacePage } from "@/components/tasks/workspace-page";

export const metadata: Metadata = { title: "Upcoming" };

export default function UpcomingPage() {
  return (
    <WorkspacePage
      scope={{ kind: "upcoming" }}
      title="Upcoming"
      subtitle="Today and everything planned after it, grouped by day."
      emptyTitle="Nothing scheduled yet"
      emptyDescription="New tasks are planned for today; give one a later date and it moves here."
      showCategory
    />
  );
}
