import { exportBackup } from "@/server/services/backup";
import { todayDateOnly } from "@/lib/dates";
import { getCurrentUser, isAuthDisabled } from "@/server/auth";
import { getSettingsRecord } from "@/server/services/settings";

export const dynamic = "force-dynamic";

/**
 * Download the whole database as a versioned JSON file.
 *
 * The response is a private backup: it is generated on demand and never stored
 * inside the application.
 */
export async function GET() {
  // The middleware already gates this route; this is the defence in depth for a
  // direct request (and a 401 is a better answer than a redirect for a download).
  if (!isAuthDisabled() && !(await getCurrentUser())) {
    return new Response("Unauthorized", { status: 401 });
  }

  const [backup, settings] = await Promise.all([exportBackup(), getSettingsRecord()]);
  const filename = `kairos-backup-${todayDateOnly(settings.timezone)}.json`;

  return new Response(JSON.stringify(backup, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
