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
