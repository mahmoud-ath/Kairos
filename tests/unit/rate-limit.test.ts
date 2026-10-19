import { describe, expect, it } from "vitest";

import {
  applyFixedWindow,
  bucketForAction,
  RATE_LIMITS,
  retryAfterSeconds,
  type RateLimitPolicy,
} from "@/lib/rate-limit";

const POLICY: RateLimitPolicy = { limit: 3, windowSeconds: 60 };
const T0 = 1_000_000;

describe("which bucket an action belongs to", () => {
  it("treats workspace-wide writes as expensive", () => {
    expect(bucketForAction("loadExampleTasks")).toBe("expensive");
    expect(bucketForAction("restoreBackup")).toBe("expensive");
    expect(bucketForAction("resetAllData")).toBe("expensive");
  });

  it("treats ordinary edits as mutations", () => {
    expect(bucketForAction("createTask")).toBe("mutation");
    expect(bucketForAction("setTaskStatus")).toBe("mutation");
    expect(bucketForAction("loadExampleTasksAgain")).toBe("mutation");
  });

  it("keeps the expensive buckets tighter than ordinary edits", () => {
    // Compare rates, not raw counts: 6 per hour is far tighter than 5 per minute.
    const perSecond = (policy: RateLimitPolicy) => policy.limit / policy.windowSeconds;
    expect(RATE_LIMITS.expensive.limit).toBeLessThan(RATE_LIMITS.mutation.limit);
    expect(perSecond(RATE_LIMITS.expensive)).toBeLessThan(perSecond(RATE_LIMITS.mutation));
    expect(perSecond(RATE_LIMITS.cron)).toBeLessThan(perSecond(RATE_LIMITS.expensive));
    expect(perSecond(RATE_LIMITS.backup)).toBeLessThan(perSecond(RATE_LIMITS.mutation));
  });
});

describe("Retry-After", () => {
  it("rounds up to whole seconds", () => {
    expect(retryAfterSeconds(T0 + 1_500, T0)).toBe(2);
    expect(retryAfterSeconds(T0 + 1, T0)).toBe(1);
  });

  it("never reports a negative wait", () => {
    expect(retryAfterSeconds(T0 - 5_000, T0)).toBe(0);
    expect(retryAfterSeconds(T0, T0)).toBe(0);
  });
});

describe("a fixed window", () => {
  it("allows exactly the limit, then blocks", () => {
    let entry = applyFixedWindow(undefined, POLICY, T0).entry;
    expect(entry.count).toBe(1);

    for (let i = 2; i <= POLICY.limit; i += 1) {
      const result = applyFixedWindow(entry, POLICY, T0 + i);
      expect(result.allowed).toBe(true);
      entry = result.entry;
    }

    const blocked = applyFixedWindow(entry, POLICY, T0 + 10);
    expect(blocked.allowed).toBe(false);
    expect(blocked.entry.count).toBe(POLICY.limit);
  });

  it("does not extend a blocked caller's window", () => {
    const full = { count: POLICY.limit, resetAt: T0 + 60_000 };
    const first = applyFixedWindow(full, POLICY, T0 + 10);
    const later = applyFixedWindow(first.entry, POLICY, T0 + 40_000);
    expect(later.allowed).toBe(false);
    expect(later.entry.resetAt).toBe(full.resetAt);
  });

  it("admits the caller again once the window has passed", () => {
    const full = { count: POLICY.limit, resetAt: T0 + 60_000 };
    const after = applyFixedWindow(full, POLICY, T0 + 60_000);
    expect(after.allowed).toBe(true);
    expect(after.entry.count).toBe(1);
    expect(after.entry.resetAt).toBe(T0 + 120_000);
  });

  it("starts a fresh window at exactly the boundary", () => {
    const fresh = { count: 1, resetAt: T0 };
    const result = applyFixedWindow(fresh, POLICY, T0);
    expect(result.allowed).toBe(true);
    expect(result.entry.count).toBe(1);
  });

  it("keeps two identifiers independent", () => {
    const alice = applyFixedWindow({ count: POLICY.limit, resetAt: T0 + 60_000 }, POLICY, T0);
    const bob = applyFixedWindow(undefined, POLICY, T0);
    expect(alice.allowed).toBe(false);
    expect(bob.allowed).toBe(true);
  });
});
