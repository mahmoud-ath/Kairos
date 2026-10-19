import { NextResponse } from "next/server";

import { isAuthorizedScheduler } from "@/server/cron-auth";
import { consumeRateLimit } from "@/server/rate-limit";
import { broadcastDailyReminder, isPushConfigured } from "@/server/services/push";

/**
 * The daily reminder broadcast.
 *
 * Called by a scheduler, not by a browser — a scheduler has no session — so the
 * shared secret in the `Authorization` header *is* the authentication. The route
 * is listed in `PUBLIC_PATHS` so middleware lets it through rather than turning
 * it into a redirect: Vercel's cron invocations do **not** follow redirects, so a
 * 307 to `/login` would silently look like a successful run.
 *
 * `GET` because that is what Vercel Cron sends, and it is also the easiest thing
 * for any other scheduler to call:
 *
 * ```bash
 * curl -H "Authorization: Bearer $KAIROS_CRON_SECRET" \
 *   https://<your-app>/api/cron/daily-reminder
 * ```
 *
 * The job itself is deliberately narrow: it sends one generic sentence to every
 * subscribed device, and reads no task, habit or category. Nothing else in Kairos
 * runs on a timer.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
/** Devices are contacted in small batches; the summary is all that is returned. */
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!isAuthorizedScheduler(request.headers.get("authorization"))) {
    // Terse on purpose: this path is reachable from the open internet.
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  if (!isPushConfigured()) {
    return NextResponse.json(
      { ok: false, error: "Web Push is not configured on this deployment." },
      { status: 503 },
    );
  }

  // One run is the whole day's work, so the budget is small — it is there to stop
  // a leaked secret from being turned into a broadcast loop, not to pace a
  // scheduler. Keyed on the job, not on an account: a scheduler has no session.
  const limit = await consumeRateLimit("daily-reminder", "cron");
  if (!limit.allowed) {
    return NextResponse.json(
      { ok: false, error: "Too many runs. Try again later." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  try {
    const summary = await broadcastDailyReminder();
    console.log("[kairos] daily reminder", summary);
    // The summary already names the reference timezone and the hour it is there.
    return NextResponse.json({ ok: true, ...summary });
  } catch (error) {
    console.error("[kairos] daily reminder failed", error);
    return NextResponse.json(
      { ok: false, error: "The reminder could not be sent." },
      { status: 500 },
    );
  }
}
