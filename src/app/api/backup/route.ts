import { exportBackup, type BackupExportScope } from "@/server/services/backup";
import { todayDateOnly } from "@/lib/dates";
import { getCurrentUser, isAuthDisabled, requireUserId } from "@/server/auth";
import { ServiceError } from "@/server/errors";
import { consumeRateLimit } from "@/server/rate-limit";
import { getSettingsRecord } from "@/server/services/settings";

export const dynamic = "force-dynamic";

/** A filename-safe fragment for the scope, so two downloads cannot look alike. */
function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
  return slug || "category";
}

/**
 * Download part or all of the database as a versioned JSON file.
 *
 * `?scope=` picks the slice: default `all`, `open` for unfinished work only, or
 * `category` with `&categoryId=`. `&history=0` leaves the task history out. The
 * response is a private export: it is generated on demand and never stored
 * inside the application.
 */
export async function GET(request: Request) {
  // The middleware already gates this route; this is the defence in depth for a
  // direct request (and a 401 is a better answer than a redirect for a download).
  if (!isAuthDisabled() && !(await getCurrentUser())) {
    return new Response("Unauthorized", { status: 401 });
  }

  const userId = await requireUserId();

  const params = new URL(request.url).searchParams;
  const requested = params.get("scope") ?? "all";
  const scope: BackupExportScope =
    requested === "open" || requested === "category" ? requested : "all";
  const categoryId = params.get("categoryId");
  const includeHistory = params.get("history") !== "0";

  if (scope === "category" && !categoryId) {
    return new Response("Pick a category to export.", { status: 400 });
  }

  // A backup reads every table, so it gets its own (hourly) budget. `Retry-After`
  // is what a download client expects; the body stays a plain sentence.
  const limit = await consumeRateLimit(userId, "backup");
  if (!limit.allowed) {
    return new Response("Too many backups. Try again later.", {
      status: 429,
      headers: {
        "Retry-After": String(limit.retryAfterSeconds),
        "Cache-Control": "no-store",
      },
    });
  }

  let backup;
  let settings;
  try {
    [backup, settings] = await Promise.all([
      exportBackup(userId, { scope, categoryId, includeHistory }),
      getSettingsRecord(userId),
    ]);
  } catch (error) {
    // The most likely refusal: the chosen category was deleted in another tab.
    if (error instanceof ServiceError) {
      return new Response(error.message, {
        status: 400,
        headers: { "Cache-Control": "no-store" },
      });
    }
    throw error;
  }

  const suffix =
    scope === "all"
      ? ""
      : scope === "open"
        ? "-open"
        : `-${slugify(backup.data.scope?.label ?? "category")}`;
  const filename = `kairos-backup-${todayDateOnly(settings.timezone)}${suffix}.json`;

  return new Response(JSON.stringify(backup, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
