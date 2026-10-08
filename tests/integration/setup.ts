import { fileURLToPath } from "node:url";

/**
 * Safety guard for the integration suite.
 *
 * These tests create and delete rows, so they must only ever run against a
 * throw-away database. A shell that has `DATABASE_URL` exported for production
 * (for example after `set -a; . ./.env.production.local`) would otherwise point
 * them straight at real user data — which is exactly the mistake this refuses to
 * repeat.
 *
 * `vitest.integration.config.ts` loads `.env`, but it does not overwrite a
 * variable that is already set, so the check has to happen here.
 */
const databaseUrl = process.env.DATABASE_URL ?? "";

function hostOf(value: string): string {
  try {
    return new URL(value).hostname;
  } catch {
    return "";
  }
}

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "db"]);
const host = hostOf(databaseUrl);

if (!LOCAL_HOSTS.has(host) && process.env.KAIROS_ALLOW_REMOTE_INTEGRATION_DB !== "true") {
  throw new Error(
    [
      "",
      `  Refusing to run integration tests against "${host || "an unparseable DATABASE_URL"}".`,
      "",
      "  These tests write and delete rows, so they only run against a local database.",
      "",
      "  Fix one of these ways:",
      "    · run them in a shell without the production variables exported,",
      "      or with `env -u DATABASE_URL -u DIRECT_URL bun run test:integration`",
      "      so the local .env is used;",
      "    · or, if this database really is disposable, set",
      "      KAIROS_ALLOW_REMOTE_INTEGRATION_DB=true to override this guard.",
      "",
    ].join("\n"),
  );
}

// Touch the import so this file is unambiguously a module, not a script.
void fileURLToPath;
