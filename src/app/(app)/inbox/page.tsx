import type { Metadata } from "next";

import { WorkspacePage } from "@/components/tasks/workspace-page";

export const metadata: Metadata = { title: "Inbox" };

export default function InboxPage() {
  return (
    <WorkspacePage
      scope={{ kind: "inbox" }}
      title="Inbox"
      subtitle="Everything that has no category or planned day yet."
      emptyTitle="Your inbox is empty"
      emptyDescription="Tasks captured without a category or a planned day land here until you organise them."
      showCategory={false}
    />
  );
}
