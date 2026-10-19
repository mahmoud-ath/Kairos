import { afterEach, describe, expect, it, vi } from "vitest";

import { RATE_LIMITS } from "@/lib/rate-limit";
import { consumeRateLimit } from "@/server/rate-limit";

/**
 * The limiter, exercised through its real store selection.
 *
 * No database is needed: `consumeRateLimit` takes the identifier explicitly, so
 * these cases describe the behaviour every entry point relies on — the 61st
 * mutation, a second account left alone, and the failure policy. `Date.now` is
 * faked so a window can be crossed without waiting a real minute.
 */

const IDENTIFIER = `rate-limit-test-${process.pid}`;

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("the mutation window", () => {
  it("allows the limit and then refuses, with a Retry-After", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-19T10:00:00Z"));

    const { limit } = RATE_LIMITS.mutation;
    for (let i = 0; i < limit; i += 1) {
      const outcome = await consumeRateLimit(IDENTIFIER, "mutation");
      expect(outcome.allowed).toBe(true);
    }

    const refused = await consumeRateLimit(IDENTIFIER, "mutation");
    expect(refused.allowed).toBe(false);
    if (refused.allowed) throw new Error("unreachable");
    expect(refused.bucket).toBe("mutation");
    expect(refused.retryAfterSeconds).toBeGreaterThan(0);
    expect(refused.retryAfterSeconds).toBeLessThanOrEqual(RATE_LIMITS.mutation.windowSeconds);
  });

  it("leaves another account unaffected", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-19T11:00:00Z"));

    for (let i = 0; i < RATE_LIMITS.mutation.limit; i += 1) {
      await consumeRateLimit(IDENTIFIER, "mutation");
    }
    expect((await consumeRateLimit(IDENTIFIER, "mutation")).allowed).toBe(false);
    expect((await consumeRateLimit(`${IDENTIFIER}-other`, "mutation")).allowed).toBe(true);
  });

  it("keeps the expensive budget separate from the ordinary one", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-19T12:00:00Z"));

    for (let i = 0; i < RATE_LIMITS.expensive.limit; i += 1) {
      await consumeRateLimit(IDENTIFIER, "expensive");
    }
    expect((await consumeRateLimit(IDENTIFIER, "expensive")).allowed).toBe(false);
    // Spending the expensive budget must not have cost the mutation budget.
    expect((await consumeRateLimit(IDENTIFIER, "mutation")).allowed).toBe(true);
  });

  it("admits the caller again once the window has passed", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-19T13:00:00Z"));

    for (let i = 0; i < RATE_LIMITS.mutation.limit; i += 1) {
      await consumeRateLimit(IDENTIFIER, "mutation");
    }
    expect((await consumeRateLimit(IDENTIFIER, "mutation")).allowed).toBe(false);

    vi.setSystemTime(new Date(Date.now() + RATE_LIMITS.mutation.windowSeconds * 1000 + 1));
    expect((await consumeRateLimit(IDENTIFIER, "mutation")).allowed).toBe(true);
  });
});

describe("when the shared store is unreachable", () => {
  it("allows the request and logs, rather than taking the app down", async () => {
    // A configured-but-dead Redis: the store is selected, every command fails.
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "http://127.0.0.1:1");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "not-a-real-token");
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});

    // Far past any limit, so only the failure policy can allow this.
    for (let i = 0; i < RATE_LIMITS.mutation.limit * 2; i += 1) {
      const outcome = await consumeRateLimit(`${IDENTIFIER}-failopen`, "mutation");
      expect(outcome.allowed).toBe(true);
    }

    expect(logged).toHaveBeenCalled();
    logged.mockRestore();
  });
});
