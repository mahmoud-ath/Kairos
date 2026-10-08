import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

/**
 * Integration tests talk to a real PostgreSQL database, because the guarantee
 * they check (one user cannot see another's rows) lives in the query layer
 * rather than in a pure function.
 *
 * They run separately from `bun run test` so the unit suite stays fast and
 * database-free.
 */

// Load .env without pulling in a dependency: these tests need DATABASE_URL.
try {
  const envFile = readFileSync(new URL("./.env", import.meta.url), "utf8");
  for (const line of envFile.split("\n")) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key]) continue;
    process.env[key] = rawValue.trim().replace(/^["']|["']$/g, "");
  }
} catch {
  // No .env file: fall back to the ambient environment.
}

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    // Refuses to run against a non-local database (see the file).
    setupFiles: ["./tests/integration/setup.ts"],
    reporters: ["default"],
    // These hit the network and the database, so they need room.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // See tests/integration/server-only.stub.ts.
      "server-only": fileURLToPath(
        new URL("./tests/integration/server-only.stub.ts", import.meta.url),
      ),
    },
  },
});
