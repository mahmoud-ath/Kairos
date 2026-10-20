import "server-only";

import { prisma } from "@/server/db";
import { requireAuthProfile } from "@/server/auth";
import {
  RATE_LIMITS,
  applyFixedWindow,
  bucketForAction,
  isRateLimitingDisabled,
  rateLimitKey,
  retryAfterSeconds,
  type RateLimitBucket,
  type RateLimitOutcome,
  type RateLimitPolicy,
  type WindowEntry,
} from "@/lib/rate-limit";

/**
 * The rate-limit store and the one call the app makes into it.
 *
 * The *rules* live in `lib/rate-limit.ts` (pure, unit tested). This module is
 * only about where the counters live, which is the part that cannot be pure:
 * a serverless instance remembers nothing between requests, so a shared counter
 * needs an external store.
 *
 * Three stores, one interface, chosen in this order:
 *
 * 1. **Upstash Redis** (`UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`) —
 *    plain `fetch` against the REST API, so no client library and nothing added to
 *    the bundle. Best choice if the project already pays for it: one command per
 *    request and no load on the database.
 * 2. **PostgreSQL** — a single `RateLimitCounter` table. This is the default on a
 *    hosted deployment, because the database is already there and a second vendor
 *    for one integer per window is a poor trade. One round trip per mutation, and
 *    it inherits the database's availability instead of adding a new dependency.
 * 3. **In-process memory** — for `next dev`, the compose stack and Playwright. One
 *    process, so the limits are real; on a hosted deployment they would not be,
 *    which is why it is never chosen there unless asked for explicitly.
 *
 * Force one with `KAIROS_RATE_LIMIT_STORE=upstash|postgres|memory`.
 *
 * **Failure policy: fail open.** If the store is unreachable, requests are allowed
 * and the failure is logged. A limiter that takes the product down when the
 * database hiccups turns a denial-of-service into an outage; availability wins, and
 * the incident is visible in the logs. See docs/rate-limiting.md.
 */

export type { RateLimitOutcome };

type StoreResult = { allowed: boolean; resetAt: number };

type RateLimitStore = {
  name: string;
  hit(key: string, policy: RateLimitPolicy, now: number): Promise<StoreResult>;
};

/** Keeps the development fallback from growing without bound. */
const MEMORY_MAX_KEYS = 5_000;

const memoryCounters = new Map<string, WindowEntry>();

const memoryStore: RateLimitStore = {
  name: "memory",
  async hit(key, policy, now) {
    const result = applyFixedWindow(memoryCounters.get(key), policy, now);
    memoryCounters.set(key, result.entry);

    if (memoryCounters.size > MEMORY_MAX_KEYS) {
      for (const [storedKey, entry] of memoryCounters) {
        if (entry.resetAt <= now) memoryCounters.delete(storedKey);
      }
      // Still too big after pruning: this is a development process whose keys are
      // not expiring, so start over rather than grow forever.
      if (memoryCounters.size > MEMORY_MAX_KEYS) memoryCounters.clear();
    }

    return { allowed: result.allowed, resetAt: result.entry.resetAt };
  },
};

/**
 * One statement, atomic, no transaction: `ON CONFLICT DO UPDATE` locks the row, so
 * two overlapping requests cannot both read the same count and both be allowed.
 *
 * This is the only raw query in `src/` (see docs/database-roles.md §7): an atomic
 * "increment or reset and tell me the new value" has no typed Prisma equivalent.
 * Values are interpolated as **parameters** — no identifier or SQL fragment ever
 * comes from a caller.
 *
 * Note that the counter also rises for a *refused* request. That is deliberate:
 * `count <= limit` is then the whole decision, and `resetAt` — which is what the
 * caller is told to wait for — is still never extended by knocking again.
 */
const postgresStore: RateLimitStore = {
  name: "postgres",
  async hit(key, policy, now) {
    const resetAt = new Date(now + policy.windowSeconds * 1000);
    const nowDate = new Date(now);

    const rows = await prisma.$queryRaw<Array<{ count: number; resetAt: Date }>>`
      INSERT INTO "RateLimitCounter" ("key", "count", "resetAt")
      VALUES (${key}, 1, ${resetAt})
      ON CONFLICT ("key") DO UPDATE SET
        "count" = CASE
          WHEN "RateLimitCounter"."resetAt" <= ${nowDate} THEN 1
          ELSE "RateLimitCounter"."count" + 1
        END,
        "resetAt" = CASE
          WHEN "RateLimitCounter"."resetAt" <= ${nowDate} THEN ${resetAt}
          ELSE "RateLimitCounter"."resetAt"
        END
      RETURNING "count", "resetAt"
    `;

    const row = rows[0];

    // Rare, opportunistic cleanup so expired rows do not accumulate. A failure
    // here must not affect the request, so it is deliberately not awaited.
    if (Math.random() < 0.01) {
      void prisma.rateLimitCounter
        .deleteMany({ where: { resetAt: { lt: new Date(now - 24 * 60 * 60 * 1000) } } })
        .catch(() => {});
    }

    return {
      allowed: row.count <= policy.limit,
      resetAt: row.resetAt.getTime(),
    };
  },
};

/** One REST command against Upstash. */
async function upstash(command: (string | number)[]): Promise<unknown> {
  const url = process.env.UPSTASH_REDIS_REST_URL?.replace(/\/+$/, "");
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error("Upstash is not configured.");

  const response = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(command),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Upstash answered ${response.status}`);
  }
  const body = (await response.json()) as { result?: unknown; error?: string };
  if (body.error) throw new Error(body.error);
  return body.result;
}

const upstashStore: RateLimitStore = {
  name: "upstash",
  async hit(key, policy, now) {
    // One round trip for the common case: INCR also answers "am I over the
    // limit?". The TTL is only set when the key has none, so a caller cannot
    // extend their own window by knocking again.
    const count = Number(await upstash(["INCR", key]));
    let ttl = Number(await upstash(["TTL", key]));
    if (!Number.isFinite(ttl) || ttl < 0) {
      await upstash(["EXPIRE", key, policy.windowSeconds]);
      ttl = policy.windowSeconds;
    }

    return {
      allowed: count <= policy.limit,
      resetAt: now + Math.max(ttl, 0) * 1000,
    };
  },
};

function isHosted(): boolean {
  return Boolean(process.env.VERCEL || process.env.VERCEL_ENV);
}

function hasUpstash(): boolean {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

let warnedAboutMemoryStore = false;

function selectStore(): RateLimitStore {
  switch (process.env.KAIROS_RATE_LIMIT_STORE) {
    case "upstash":
      return upstashStore;
    case "postgres":
      return postgresStore;
    case "memory":
      return memoryStore;
    default:
      break;
  }

  if (hasUpstash()) return upstashStore;
  if (isHosted()) return postgresStore;

  if (!warnedAboutMemoryStore) {
    warnedAboutMemoryStore = true;
    console.info(
      "[kairos] rate limiting uses in-process memory: correct for a single local " +
        "process, not shared across instances. A hosted deployment selects the " +
        "PostgreSQL store automatically (docs/rate-limiting.md).",
    );
  }
  return memoryStore;
}

/**
 * Account for one use of a bucket by an identifier.
 *
 * Never throws: a store failure is logged and the request is allowed.
 */
export async function consumeRateLimit(
  identifier: string,
  bucket: RateLimitBucket,
): Promise<RateLimitOutcome> {
  if (isRateLimitingDisabled()) return { allowed: true };

  const policy = RATE_LIMITS[bucket];
  const store = selectStore();
  const now = Date.now();

  try {
    const result = await store.hit(rateLimitKey(bucket, identifier), policy, now);
    if (result.allowed) return { allowed: true };
    return {
      allowed: false,
      bucket,
      policy,
      retryAfterSeconds: retryAfterSeconds(result.resetAt, now),
    };
  } catch (error) {
    console.error(`[kairos] rate limit store (${store.name}) failed; allowing`, error);
    return { allowed: true };
  }
}

/** Account for one server action for the current account. */
export async function consumeActionRateLimit(action: string): Promise<RateLimitOutcome> {
  const { userId } = await requireAuthProfile();
  return consumeRateLimit(userId, bucketForAction(action));
}
