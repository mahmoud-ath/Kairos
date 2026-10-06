import type { Metadata } from "next";

import { WorkspacePage } from "@/components/tasks/workspace-page";
import { viewMetadata } from "@/lib/site";

export const metadata: Metadata = viewMetadata({
  title: "Upcoming",
  description:
    "Everything planned from today onwards in Kairos, grouped by day so the week ahead is easy to scan.",
  path: "/upcoming",
});

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
