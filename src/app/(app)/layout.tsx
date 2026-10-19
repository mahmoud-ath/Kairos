import type { Metadata } from "next";

import { AppShell } from "@/components/layout/app-shell";
import { buildViewCounts } from "@/lib/views";
import { isAuthDisabled } from "@/server/auth";
import { getRequestContext } from "@/server/context";
import { ensureHabitInstances } from "@/server/services/habits";
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
  // A signed-out visitor is redirected before any query runs below, and the
  // account's clock is read once for the whole render.
  const ctx = await getRequestContext();
  const { userId, email, settings, today } = ctx;

  // Every habit that is due today needs its generated task before anything
  // counts or lists tasks. This is idempotent, so it is safe on every render.
  await ensureHabitInstances(ctx);

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
