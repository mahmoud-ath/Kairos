"use server";

import { z } from "zod";

import type { BackupSummary } from "@/lib/backup";
import { updateSettingsSchema } from "@/lib/validation";
import type { ActionResult, SettingsDTO } from "@/types/kairos";
import { runAction } from "@/server/actions/helpers";
import { exportBackup, importBackup, resetAllData } from "@/server/services/backup";
import { updateSettings } from "@/server/services/settings";

const importInputSchema = z.object({
  json: z.string().min(2, "The file is empty.").max(50_000_000),
});

const resetInputSchema = z.object({
  confirm: z.literal("RESET", {
    errorMap: () => ({ message: "Type RESET to confirm." }),
  }),
});

export async function updateSettingsAction(input: unknown): Promise<ActionResult<SettingsDTO>> {
  return runAction(async () => {
    const values = updateSettingsSchema.parse(input);
    const settings = await updateSettings(values);
    return {
      theme: settings.theme as SettingsDTO["theme"],
      timezone: settings.timezone,
      weekStartsOn: settings.weekStartsOn,
    };
  });
}

/** Validate and replace all data from a JSON backup (text form). */
export async function importBackupAction(
  input: unknown,
): Promise<ActionResult<{ summary: BackupSummary }>> {
  return runAction(async () => {
    const { json } = importInputSchema.parse(input);
    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch {
      throw new Error("The selected file is not valid JSON.");
    }
    return importBackup(parsed);
  });
}

/** Delete every task, category and event; settings return to defaults. */
export async function resetAllDataAction(input: unknown): Promise<ActionResult<undefined>> {
  return runAction(async () => {
    resetInputSchema.parse(input);
    await resetAllData();
    return undefined;
  });
}

/** Serialize the current database as a versioned JSON backup string. */
export async function buildExportAction(): Promise<ActionResult<string>> {
  return runAction(
    async () => {
      const backup = await exportBackup();
      return JSON.stringify(backup, null, 2);
    },
    { revalidate: false },
  );
}
