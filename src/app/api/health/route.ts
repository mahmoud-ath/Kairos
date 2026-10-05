import { NextResponse } from "next/server";

import { prisma } from "@/server/db";

export const dynamic = "force-dynamic";

/** Liveness/readiness probe used by Docker and Compose. */
export async function GET() {
  try {
    await prisma.settings.count();
    return NextResponse.json({ ok: true, database: "ok" });
  } catch (error) {
    console.error("[kairos] health check failed", error);
    return NextResponse.json(
      { ok: false, database: "error" },
      { status: 503 },
    );
  }
}
