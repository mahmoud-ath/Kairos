import { NextResponse } from "next/server";

import { prisma } from "@/server/db";

export const dynamic = "force-dynamic";

/**
 * Columns the app reads on every page.
 *
 * `COUNT(*)` does not touch any column, so a health check built on `count()`
 * reports "ok" while a missing migration 500s every page — which is exactly what
 * happened when `Settings.nickname` shipped before `prisma migrate deploy` ran
 * against production. Selecting the columns turns schema drift into a failing
 * health check instead.
 */
const SETTINGS_SCHEMA_PROBE = {
  userId: true,
  theme: true,
  timezone: true,
  weekStartsOn: true,
  nickname: true,
  avatarId: true,
  fontScale: true,
} as const;

/** Liveness/readiness probe used by Docker and Compose. */
export async function GET() {
  try {
    // Reads (not counts) so a missing column is reported as unhealthy.
    await prisma.settings.findFirst({ select: SETTINGS_SCHEMA_PROBE });
    await prisma.category.findFirst({ select: { id: true, icon: true } });
    return NextResponse.json({ ok: true, database: "ok" });
  } catch (error) {
    console.error("[kairos] health check failed", error);
    return NextResponse.json(
      { ok: false, database: "error" },
      { status: 503 },
    );
  }
}
