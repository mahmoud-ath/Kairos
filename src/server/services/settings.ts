import "server-only";

import { DEFAULT_TIMEZONE } from "@/lib/constants";
import { isValidTimeZone } from "@/lib/dates";
import type { ThemePreference } from "@/types/kairos";
import { prisma, type Prisma } from "@/server/db";

// Settings are keyed by their owner; there is no fixed singleton id any more.

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
 * Read one owner's settings, creating the row on first use.
 * Every user has exactly one row, keyed by their id.
 */
export async function getSettings(
  userId: string,
  db: Prisma.TransactionClient | typeof prisma = prisma,
) {
  const existing = await db.settings.findUnique({ where: { userId } });
  if (existing) return existing;

  return db.settings.upsert({
    where: { userId },
    update: {},
    create: { userId, timezone: detectTimeZone() },
  });
}

export async function getSettingsRecord(userId: string): Promise<SettingsRecord> {
  const settings = await getSettings(userId);
  return {
    theme: settings.theme as ThemePreference,
    timezone: settings.timezone,
    weekStartsOn: settings.weekStartsOn,
  };
}

export async function updateSettings(
  userId: string,
  values: {
    theme?: ThemePreference;
    timezone?: string;
    weekStartsOn?: number;
  },
) {
  await getSettings(userId);
  const data: Prisma.SettingsUpdateInput = {};
  if (values.theme !== undefined) data.theme = values.theme;
  if (values.timezone !== undefined) data.timezone = values.timezone;
  if (values.weekStartsOn !== undefined) data.weekStartsOn = values.weekStartsOn;

  return prisma.settings.update({ where: { userId }, data });
}
