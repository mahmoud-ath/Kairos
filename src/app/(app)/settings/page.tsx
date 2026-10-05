import type { Metadata } from "next";

import { BackupPanel } from "@/components/settings/backup-panel";
import { PreferencesForm } from "@/components/settings/preferences-form";
import { TaxonomyManager } from "@/components/settings/taxonomy-manager";
import { getSettingsRecord } from "@/server/services/settings";
import { prisma } from "@/server/db";
import { listCategories, listLabels } from "@/server/services/taxonomy";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const [settings, categories, labels, taskCount] = await Promise.all([
    getSettingsRecord(),
    listCategories(),
    listLabels(),
    prisma.task.count({ where: { parentId: null } }),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-6 sm:px-6 lg:py-10">
      <header>
        <h1 className="text-lg font-semibold tracking-tight">Settings</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Preferences are stored in your local database.
        </p>
      </header>

      <PreferencesForm settings={settings} />
      <TaxonomyManager categories={categories} labels={labels} />
      <BackupPanel taskCount={taskCount} />
    </div>
  );
}
