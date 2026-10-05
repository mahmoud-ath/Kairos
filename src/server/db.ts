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
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env (local development) or set DATABASE_URL to an absolute path under /data (Docker).",
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
