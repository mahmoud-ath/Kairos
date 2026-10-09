import type { Metadata } from "next";

import { BackupPanel } from "@/components/settings/backup-panel";
import { PreferencesForm } from "@/components/settings/preferences-form";
import { ProfilePanel } from "@/components/settings/profile-panel";
import { TaxonomyManager } from "@/components/settings/taxonomy-manager";
import { isAuthDisabled, requireAuthProfile } from "@/server/auth";
import { scopedPrisma } from "@/server/db";
import { getSettingsRecord } from "@/server/services/settings";
import { listCategories } from "@/server/services/taxonomy";
import { viewMetadata } from "@/lib/site";

export const metadata: Metadata = viewMetadata({
  title: "Settings",
  description:
    "Kairos preferences: theme, timezone, first day of the week, categories, JSON backup export and import, and reset.",
  path: "/settings",
});

export default async function SettingsPage() {
  const { userId, email } = await requireAuthProfile();
  const [settings, categories, taskCount] = await Promise.all([
    getSettingsRecord(userId),
    listCategories(userId),
    scopedPrisma(userId).task.count({ where: { parentId: null } }),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-6 sm:px-6 lg:py-10">
      <h1 className="text-base font-semibold tracking-tight">Settings</h1>

      <ProfilePanel email={email} authEnabled={!isAuthDisabled()} />
      <PreferencesForm settings={settings} />
      <TaxonomyManager categories={categories} />
      <BackupPanel taskCount={taskCount} />
    </div>
  );
}
