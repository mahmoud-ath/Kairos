"use server";

import { z } from "zod";

import { avatarById, isAvatarUnlocked } from "@/lib/avatars";
import type { BackupSummary } from "@/lib/backup";
import { updateProfileSchema, updateSettingsSchema } from "@/lib/validation";
import type { ActionResult, ProfileDTO, SettingsDTO } from "@/types/kairos";
import { requireUserId } from "@/server/auth";
import { runAction } from "@/server/actions/helpers";
import { exportBackup, importBackup, resetAllData } from "@/server/services/backup";
import { countCompletions } from "@/server/services/profile";
import { updateSettings } from "@/server/services/settings";
import { ServiceError } from "@/server/errors";

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
    const userId = await requireUserId();
    const values = updateSettingsSchema.parse(input);
    const settings = await updateSettings(userId, values);
    return {
      theme: settings.theme as SettingsDTO["theme"],
      timezone: settings.timezone,
      weekStartsOn: settings.weekStartsOn,
      nickname: settings.nickname ?? null,
      avatarId: settings.avatarId,
      fontScale: settings.fontScale as SettingsDTO["fontScale"],
      reminderHour: settings.reminderHour,
    };
  });
}

/**
 * Save the nickname and/or avatar.
 *
 * The unlock rule is checked here, on the server, against the same pure
 * catalogue the UI uses — a locked id sent straight to the action is refused.
 */
export async function updateProfileAction(input: unknown): Promise<ActionResult<ProfileDTO>> {
  return runAction(async () => {
    const userId = await requireUserId();
    const values = updateProfileSchema.parse(input);

    if (values.avatarId !== undefined) {
      const completed = await countCompletions(userId);
      const avatar = avatarById(values.avatarId);
      if (!isAvatarUnlocked(avatar, completed)) {
        const needed =
          avatar.unlock.kind === "completed" ? avatar.unlock.count - completed : 0;
        throw new ServiceError(
          `“${avatar.label}” is still locked — complete ${needed} more task${
            needed === 1 ? "" : "s"
          } to unlock it.`,
        );
      }
    }

    const settings = await updateSettings(userId, values);
    return { nickname: settings.nickname ?? null, avatarId: settings.avatarId };
  });
}

/** Validate and replace all data from a JSON backup (text form). */
export async function importBackupAction(
  input: unknown,
): Promise<ActionResult<{ summary: BackupSummary }>> {
  return runAction(async () => {
    const userId = await requireUserId();
    const { json } = importInputSchema.parse(input);
    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch {
      throw new Error("The selected file is not valid JSON.");
    }
    return importBackup(userId, parsed);
  });
}

/** Delete every task, category and event; settings return to defaults. */
export async function resetAllDataAction(input: unknown): Promise<ActionResult<undefined>> {
  return runAction(async () => {
    const userId = await requireUserId();
    resetInputSchema.parse(input);
    await resetAllData(userId);
    return undefined;
  });
}

/** Serialize the current database as a versioned JSON backup string. */
export async function buildExportAction(): Promise<ActionResult<string>> {
  return runAction(
    async () => {
      const userId = await requireUserId();
      const backup = await exportBackup(userId);
      return JSON.stringify(backup, null, 2);
    },
    { revalidate: false },
  );
}
