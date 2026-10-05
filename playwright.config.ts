import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests run against a production build with a throw-away SQLite
 * database, so they never touch a real workspace.
 */
const PORT = process.env.KAIROS_E2E_PORT ?? "3211";
const BASE_URL = `http://127.0.0.1:${PORT}`;
const E2E_DB = "file:./e2e-test.db";

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
      "rm -f prisma/e2e-test.db prisma/e2e-test.db-journal",
      `DATABASE_URL="${E2E_DB}" bunx prisma migrate deploy`,
      `DATABASE_URL="${E2E_DB}" PORT=${PORT} bunx next start`,
    ].join(" && "),
    url: `${BASE_URL}/today`,
    reuseExistingServer: false,
    timeout: 180_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
