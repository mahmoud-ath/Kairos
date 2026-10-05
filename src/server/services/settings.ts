import "server-only";

import { DEFAULT_TIMEZONE } from "@/lib/constants";
import { isValidTimeZone } from "@/lib/dates";
import type { ThemePreference } from "@/types/kairos";
import { prisma, type Prisma } from "@/server/db";

export const SETTINGS_ID = "singleton";

export type SettingsRecord = {
  theme: ThemePreference;
  timezone: string;
  weekStartsOn: number;
};

/** Best-effort guess of the server's timezone, used only for first-run setup. */
function detectTimeZone(): string {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return zone && isValidTimeZone(zone) ? zone : DEFAULT_TIMEZONE;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}

/**
 * Read the singleton settings row, creating it on first run.
 * The row is never deleted, so `Settings` always has exactly one record.
 */
export async function getSettings(
  db: Prisma.TransactionClient | typeof prisma = prisma,
) {
  const existing = await db.settings.findUnique({ where: { id: SETTINGS_ID } });
  if (existing) return existing;

  return db.settings.upsert({
    where: { id: SETTINGS_ID },
    update: {},
    create: { id: SETTINGS_ID, timezone: detectTimeZone() },
  });
}

export async function getSettingsRecord(): Promise<SettingsRecord> {
  const settings = await getSettings();
  return {
    theme: settings.theme as ThemePreference,
    timezone: settings.timezone,
    weekStartsOn: settings.weekStartsOn,
  };
}

export async function updateSettings(values: {
  theme?: ThemePreference;
  timezone?: string;
  weekStartsOn?: number;
}) {
  await getSettings();
  const data: Prisma.SettingsUpdateInput = {};
  if (values.theme !== undefined) data.theme = values.theme;
  if (values.timezone !== undefined) data.timezone = values.timezone;
  if (values.weekStartsOn !== undefined) data.weekStartsOn = values.weekStartsOn;

  return prisma.settings.update({ where: { id: SETTINGS_ID }, data });
}
