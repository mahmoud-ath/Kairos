import type { Metadata } from "next";

import { BackupPanel } from "@/components/settings/backup-panel";
import { NotificationsPanel } from "@/components/settings/notifications-panel";
import { PreferencesForm } from "@/components/settings/preferences-form";
import { ProfilePanel } from "@/components/settings/profile-panel";
import { TaxonomyManager } from "@/components/settings/taxonomy-manager";
import { isAuthDisabled } from "@/server/auth";
import { getRequestContext } from "@/server/context";
import { scopedPrisma } from "@/server/db";
import { countCompletions } from "@/server/services/profile";
import { countDevices, vapidConfig } from "@/server/services/push";
import { listCategories } from "@/server/services/taxonomy";
import { viewMetadata } from "@/lib/site";

export const metadata: Metadata = viewMetadata({
  title: "Settings",
  description:
    "Kairos preferences: theme, timezone, first day of the week, notifications, categories, JSON backup export and import, and reset.",
  path: "/settings",
});

export default async function SettingsPage() {
  // The layout already built the context for this request, so this reuses that
  // read rather than fetching the settings row a second time.
  const { userId, email, settings } = await getRequestContext();
  const [categories, taskCount, completedCount, deviceCount] = await Promise.all([
    listCategories(userId),
    // Generated habit instances are not part of the task list, so they are not
    // part of the number the backup panel reports either.
    scopedPrisma(userId).task.count({ where: { parentId: null, habitId: null } }),
    countCompletions(userId),
    countDevices(userId),
  ]);

  // Only the public half of the VAPID pair reaches the browser, and only when
  // both halves are present and well formed — otherwise the panel explains that
  // the deployment is missing its keys instead of offering a button that cannot
  // work.
  const vapid = vapidConfig();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-6 sm:px-6 lg:py-10">
      <h1 className="text-base font-semibold tracking-tight">Settings</h1>

      <ProfilePanel
        settings={settings}
        email={email}
        authEnabled={!isAuthDisabled()}
        completedCount={completedCount}
      />
      <PreferencesForm settings={settings} />
      <NotificationsPanel
        publicKey={vapid?.publicKey ?? null}
        deviceCount={deviceCount}
        reminderHour={settings.reminderHour}
        timeZone={settings.timezone}
      />
      <TaxonomyManager categories={categories} />
      <BackupPanel taskCount={taskCount} />
    </div>
  );
}
