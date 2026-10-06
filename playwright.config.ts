import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests run against a production build and a throw-away PostgreSQL
 * database, so they never touch a real workspace.
 *
 * Point `E2E_DATABASE_URL` at any disposable PostgreSQL — the `db` service in
 * compose.yaml creates `kairos_e2e` for exactly this purpose. The schema is
 * dropped and rebuilt from the committed migrations on every run.
 *
 * `KAIROS_AUTH_DISABLED=true` keeps the Supabase sign-in gate out of the way:
 * the suite has no Supabase session to present.
 */
const PORT = process.env.KAIROS_E2E_PORT ?? "3211";
const BASE_URL = `http://127.0.0.1:${PORT}`;
const E2E_DATABASE_URL =
  process.env.E2E_DATABASE_URL ?? "postgresql://kairos:kairos@localhost:5432/kairos_e2e";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: [
      `DATABASE_URL="${E2E_DATABASE_URL}" DIRECT_URL="${E2E_DATABASE_URL}" bunx prisma migrate reset --force --skip-generate`,
      `NEXT_PUBLIC_APP_URL="${BASE_URL}" KAIROS_AUTH_DISABLED=true DATABASE_URL="${E2E_DATABASE_URL}" DIRECT_URL="${E2E_DATABASE_URL}" PORT=${PORT} bunx next start`,
    ].join(" && "),
    url: `${BASE_URL}/today`,
    reuseExistingServer: false,
    timeout: 180_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
