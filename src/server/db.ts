import "server-only";

import { PrismaClient } from "@prisma/client";

/**
 * A single Prisma client per process.
 *
 * In development Next.js re-evaluates modules on every change; without the
 * global cache we would open a new SQLite connection on each reload until the
 * file locks pile up. In production a single instance is exactly what we want —
 * Kairos is documented as a one-process, one-database deployment.
 */
const globalForPrisma = globalThis as unknown as {
  kairosPrisma?: PrismaClient;
};

function createClient() {
  // Only DATABASE_URL is checked. Verified: Prisma Client does not validate
  // `directUrl` when it is constructed — that variable is read by the Prisma CLI
  // alone, so requiring it here would break deployments that only set
  // DATABASE_URL. See DEPLOYMENT.md §11.1.
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env for local development, " +
        "or set it in your host's environment variables (see DEPLOYMENT.md §11.1).",
    );
  }

  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

export const prisma: PrismaClient = globalForPrisma.kairosPrisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.kairosPrisma = prisma;
}

export type { Prisma } from "@prisma/client";
