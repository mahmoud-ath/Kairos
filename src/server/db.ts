import "server-only";

import { PrismaClient } from "@prisma/client";
import type { Prisma } from "@prisma/client";

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

/* -------------------------------------------------------------------------- */
/* Multi-user scoping                                                         */
/* -------------------------------------------------------------------------- */

/** Models whose rows belong to exactly one user. */
const TENANT_MODELS = new Set(["Task", "Category", "TaskEvent", "Settings"]);

/** Operations whose `where` must be narrowed to the owner. */
const FILTERED_OPERATIONS = new Set([
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "findUnique",
  "findUniqueOrThrow",
  "count",
  "aggregate",
  "groupBy",
  "update",
  "updateMany",
  "delete",
  "deleteMany",
  "upsert",
]);

/** Operations that write new rows and therefore need an owner stamp. */
const STAMPED_OPERATIONS = new Set(["create", "createMany", "upsert"]);

/**
 * A Prisma client that can only see one user's rows.
 *
 * Rather than trusting every call site to remember `where: { userId }`, the
 * filter is injected into every operation on a tenant model. A query written
 * without an owner filter is therefore impossible, not merely discouraged —
 * which is the whole point of a security boundary.
 *
 * Services take this client as their first argument:
 *
 * ```ts
 * export async function listTasks(userId: string) {
 *   const prisma = scopedPrisma(userId);   // shadows the unscoped import
 *   return prisma.task.findMany({ where: { parentId: null } });
 * }
 * ```
 *
 * Known limit: extension hooks apply to top-level operations only. Relations
 * pulled in through `include` (a task's subtasks) are not filtered here. That is
 * safe because a subtask is always created with its parent's owner and cannot be
 * reparented across users — see `createTask`/`updateTask`, which resolve the
 * parent through this same scoped client, so another user's parent is invisible.
 */
export function scopedPrisma(userId: string) {
  if (!userId) {
    // Fail closed. An empty owner must never widen into "all rows".
    throw new Error(
      "scopedPrisma() was called without a userId. Refusing to run an unscoped query.",
    );
  }

  return prisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!TENANT_MODELS.has(model)) return query(args);

          const mutable = args as {
            where?: Record<string, unknown>;
            data?: unknown;
          };

          if (FILTERED_OPERATIONS.has(operation)) {
            mutable.where = { ...(mutable.where ?? {}), userId };
          }

          if (STAMPED_OPERATIONS.has(operation)) {
            mutable.data = Array.isArray(mutable.data)
              ? mutable.data.map((row) => ({ ...(row as object), userId }))
              : { ...(mutable.data as object | undefined), userId };
          }

          return query(args);
        },
      },
    },
  }) as unknown as PrismaClient;
  // The cast keeps Prisma's normal result typing (`include` relations and so
  // on). The extension changes behaviour at runtime, not the type surface, so
  // writes still name their owner explicitly — which is auditable — while
  // reads, updates and deletes are narrowed for you.
}

/** A Prisma client bound to one owner: same type, narrower behaviour. */
export type ScopedClient = PrismaClient;

/** A scoped client, or the transaction it opened. */
export type ScopedTx = PrismaClient | Prisma.TransactionClient;
