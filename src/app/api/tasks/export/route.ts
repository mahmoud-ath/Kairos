import { todayDateOnly } from "@/lib/dates";
import { isAuthDisabled, getCurrentUser, requireUserId } from "@/server/auth";
import { consumeRateLimit } from "@/server/rate-limit";
import { getSettings } from "@/server/services/settings";
import { exportTasks } from "@/server/services/task-transfer";

export const dynamic = "force-dynamic";

/**
 * Download this account's tasks (and their subtasks) as a JSON transfer file.
 *
 * A *transfer*, not a backup: no settings, no habits, no history, and no ids —
 * see `lib/task-transfer.ts`. It is offered from the top bar and only answers
 * while the `dataToolsEnabled` preference is on, so a feature that is switched
 * off is not reachable by guessing the URL.
 */
export async function GET() {
  // The middleware already gates this route; this is the defence in depth for a
  // direct request (and a 401 is a better answer than a redirect for a download).
  if (!isAuthDisabled() && !(await getCurrentUser())) {
    return new Response("Unauthorized", { status: 401 });
  }

  const userId = await requireUserId();
  const settings = await getSettings(userId);
  if (!settings.dataToolsEnabled) {
    return new Response("Task export is switched off in settings.", { status: 403 });
  }

  // Exports share the backup budget: they read the same table.
  const limit = await consumeRateLimit(userId, "backup");
  if (!limit.allowed) {
    return new Response("Too many exports. Try again later.", {
      status: 429,
      headers: {
        "Retry-After": String(limit.retryAfterSeconds),
        "Cache-Control": "no-store",
      },
    });
  }

  const file = await exportTasks(userId);
  const filename = `kairos-tasks-${todayDateOnly(settings.timezone)}.json`;

  return new Response(JSON.stringify(file, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
