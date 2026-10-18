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

/**
 * The habit migration, probed the same way.
 *
 * `ensureHabitInstances()` runs in the app shell, so this migration is on the
 * path of **every** workspace page rather than behind a feature: shipping the
 * code without it 500s `/today`, `/tasks` and everything else at once. That
 * happened once (13 Oct 2026) and the health check stayed green throughout,
 * which is the whole reason these probes select rows instead of counting them.
 */
const HABIT_SCHEMA_PROBE = {
  task: { id: true, habitId: true, habitDate: true },
  habit: { id: true, days: true, startDate: true, paused: true },
} as const;

/** Liveness/readiness probe used by Docker and Compose. */
export async function GET() {
  try {
    // Reads (not counts) so a missing column is reported as unhealthy.
    await prisma.settings.findFirst({ select: SETTINGS_SCHEMA_PROBE });
    await prisma.category.findFirst({ select: { id: true, icon: true } });
    await prisma.task.findFirst({ select: HABIT_SCHEMA_PROBE.task });
    await prisma.habit.findFirst({ select: HABIT_SCHEMA_PROBE.habit });
    return NextResponse.json({ ok: true, database: "ok" });
  } catch (error) {
    console.error("[kairos] health check failed", error);
    return NextResponse.json(
      { ok: false, database: "error" },
      { status: 503 },
    );
  }
}
