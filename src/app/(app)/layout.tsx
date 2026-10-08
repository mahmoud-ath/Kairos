import { AppShell } from "@/components/layout/app-shell";
import { buildViewCounts } from "@/lib/views";
import { todayDateOnly } from "@/lib/dates";
import { isAuthDisabled, requireUserId } from "@/server/auth";
import { getSettingsRecord } from "@/server/services/settings";
import { listTaskSummaries } from "@/server/services/tasks";
import { listCategories } from "@/server/services/taxonomy";
import type { AppData } from "@/components/app-data";

// Task data is mutable: never serve a cached render of the app shell.
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // A signed-out visitor is redirected before any query runs below.
  const userId = await requireUserId();

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
  };

  return <AppShell data={data}>{children}</AppShell>;
}
