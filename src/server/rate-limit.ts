import "server-only";

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
 * Two stores, one interface:
 *
 * - **Upstash Redis** (`UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`) is
 *   used whenever it is configured. It is plain `fetch` against the REST API —
 *   no client library, so nothing is added to the bundle or the cold start.
 * - **In-process memory** otherwise. That is honest for `next dev`, the compose
 *   stack and the Playwright suite (one process, real limiting), and it is
 *   *useless* on a hosted deployment with several instances — which is why the
 *   fallback logs once instead of pretending to protect anything.
 *
 * **Failure policy: fail open.** If the store is unreachable, requests are
 * allowed and the failure is logged. A limiter that takes the product down when
 * Redis hiccups turns a denial-of-service into an outage; availability wins, and
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

const redisStore: RateLimitStore = {
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

let warnedAboutMemoryStore = false;

function selectStore(): RateLimitStore {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    return redisStore;
  }
  if (isHosted() && !warnedAboutMemoryStore) {
    warnedAboutMemoryStore = true;
    console.warn(
      "[kairos] rate limiting is using in-process memory, which does not survive " +
        "between instances on a hosted deployment. Set UPSTASH_REDIS_REST_URL and " +
        "UPSTASH_REDIS_REST_TOKEN to enable shared limits (docs/rate-limiting.md).",
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
