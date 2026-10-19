/**
 * Rate limiting — the rules, with no I/O.
 *
 * Advisory limits for the app's own entry points. Two facts shape them:
 *
 * - **Nearly every mutation is a Server Action**, not a REST route, so the
 *   limiter belongs in `runAction()` rather than on `/api/*`. A limiter on the
 *   API routes alone would protect three handlers and none of the writes.
 * - **The identifier must be the account**, not the IP. A household behind one
 *   NAT would throttle each other, and an attacker with many addresses would sail
 *   through. IP is the fallback for anonymous requests only.
 *
 * The store is deliberately *not* here: a shared counter needs Redis (or the
 * database) because a serverless instance cannot remember anything between
 * requests. This module only decides what the limits are and whether a window has
 * been exhausted, which is the part worth testing.
 *
 * See docs/rate-limiting.md for the design and the rollout order.
 */

export type RateLimitPolicy = {
  /** Requests allowed per window. */
  limit: number;
  windowSeconds: number;
};

/** Which family of request is being limited. */
export type RateLimitBucket = "mutation" | "expensive" | "backup" | "cron";

/**
 * The limits.
 *
 * `mutation` is generous on purpose: a person types a handful of tasks a minute,
 * and drag-and-drop bursts are real. The limits exist to stop scripts, not
 * people. The expensive bucket covers actions that rewrite the whole workspace.
 */
export const RATE_LIMITS: Record<RateLimitBucket, RateLimitPolicy> = {
  mutation: { limit: 60, windowSeconds: 60 },
  expensive: { limit: 5, windowSeconds: 60 },
  backup: { limit: 10, windowSeconds: 3600 },
  cron: { limit: 6, windowSeconds: 3600 },
};

/** Actions that are cheap to call and expensive to serve. */
const EXPENSIVE_ACTIONS = new Set(["loadExampleTasks", "restoreBackup", "resetAllData"]);

/** Which bucket an action belongs to. Pure, so the mapping is unit-tested. */
export function bucketForAction(action: string): RateLimitBucket {
  return EXPENSIVE_ACTIONS.has(action) ? "expensive" : "mutation";
}

/**
 * The key one counter lives under.
 *
 * The bucket is part of the key so the same account cannot spend its 60
 * mutations on 60 restores, and the identifier is namespaced so a cron key can
 * never collide with an account id.
 *
 * `:` is safe even though the identifier is user-supplied on nothing — accounts
 * come from the session — but the prefix keeps the namespace obvious in Redis.
 */
export function rateLimitKey(bucket: RateLimitBucket, identifier: string): string {
  return `kairos:rl:${bucket}:${identifier}`;
}

/**
 * The answer one request gets from the limiter.
 *
 * A refusal carries everything the transport needs — the bucket for logging, the
 * policy for context and `retryAfterSeconds` for a `Retry-After` header — so the
 * store, the action wrapper and the route handlers all describe the same thing.
 */
export type RateLimitOutcome =
  | { allowed: true }
  | {
      allowed: false;
      bucket: RateLimitBucket;
      policy: RateLimitPolicy;
      retryAfterSeconds: number;
    };

/**
 * Turn the limiter off for a local run.
 *
 * A test suite and a screenshot script are *programs*: they make more requests
 * per minute than any person, so they trip limits that exist for people. This
 * switch is for them, and it follows the same rule as the auth switch in
 * `lib/auth-rules.ts` — **it is ignored on a hosted deployment**, because a
 * limiter that an environment variable can disable on the internet is not a
 * limiter at all.
 */
export function isRateLimitingDisabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  if (env.KAIROS_RATE_LIMIT_DISABLED !== "true") return false;
  const hosted =
    env.VERCEL === "1" ||
    env.VERCEL_ENV === "production" ||
    env.VERCEL_ENV === "preview";
  return !hosted;
}

/**
 * The message a limited caller sees.
 *
 * It says how long to wait, because "too many requests" with no number reads like
 * a bug. Under a minute the seconds are rounded up, so nobody is told to retry in
 * "0 seconds"; over a minute it switches to whole minutes.
 */
export function rateLimitMessage(outcome: RateLimitOutcome): string {
  if (outcome.allowed) return "";
  const seconds = outcome.retryAfterSeconds;
  if (seconds <= 1) return "Too many requests. Try again in a second.";
  if (seconds < 60) return `Too many requests. Try again in ${seconds} seconds.`;
  const minutes = Math.ceil(seconds / 60);
  return `Too many requests. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`;
}

/** Seconds until the window resets, for `Retry-After`. Never negative. */
export function retryAfterSeconds(resetAt: number, now: number): number {
  return Math.max(0, Math.ceil((resetAt - now) / 1000));
}

/** One identifier's state inside a window. */
export type WindowEntry = {
  count: number;
  /** Epoch milliseconds when the window opens again. */
  resetAt: number;
};

/**
 * Account for one request in a fixed window.
 *
 * Fixed windows rather than sliding ones because this is also the fallback for a
 * single-process developer machine, and they are trivial to reason about. The
 * production store (Upstash) does sliding windows itself; this function is what
 * makes the local behaviour identical in shape and testable.
 *
 * A request exactly at `resetAt` starts a new window — the boundary belongs to the
 * new window, so a caller cannot squeeze two requests into the same millisecond.
 */
export function applyFixedWindow(
  entry: WindowEntry | undefined,
  policy: RateLimitPolicy,
  now: number,
): { allowed: boolean; entry: WindowEntry } {
  if (!entry || entry.resetAt <= now) {
    return {
      allowed: true,
      entry: { count: 1, resetAt: now + policy.windowSeconds * 1000 },
    };
  }

  if (entry.count >= policy.limit) {
    // Keep the existing window: resetting it here would let a blocked caller
    // extend their own window forever.
    return { allowed: false, entry };
  }

  return { allowed: true, entry: { count: entry.count + 1, resetAt: entry.resetAt } };
}
