import type { Metadata } from "next";

import { AppShell } from "@/components/layout/app-shell";
import { buildViewCounts } from "@/lib/views";
import { todayDateOnly } from "@/lib/dates";
import { isAuthDisabled, requireAuthProfile } from "@/server/auth";
import { getSettingsRecord } from "@/server/services/settings";
import { listTaskSummaries } from "@/server/services/tasks";
import { listCategories } from "@/server/services/taxonomy";
import type { AppData } from "@/components/app-data";

/**
 * The workspace is private. It already redirects signed-out visitors to
 * `/login`, and this keeps the pages themselves out of any index that found the
 * URLs some other way.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

// Task data is mutable: never serve a cached render of the app shell.
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // A signed-out visitor is redirected before any query runs below.
  const { userId, email } = await requireAuthProfile();

  const settings = await getSettingsRecord(userId);
  const today = todayDateOnly(settings.timezone);

  const [categories, summaries] = await Promise.all([
    listCategories(userId),
    listTaskSummaries(userId),
  ]);

  const data: AppData = {
    settings,
    today,
    categories,
    counts: buildViewCounts(summaries, today),
    authEnabled: !isAuthDisabled(),
    email,
  };

  return <AppShell data={data}>{children}</AppShell>;
}
