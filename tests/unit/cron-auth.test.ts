import { afterEach, describe, expect, it } from "vitest";

import { isAuthorizedScheduler, schedulerSecret } from "@/server/cron-auth";

/**
 * The daily broadcast is reachable without a session, so the shared secret is the
 * whole of its authentication. These are the cases that decide whether a stranger
 * can make Kairos push a notification to every subscribed device.
 */
describe("scheduler authentication", () => {
  const SECRET = "correct-horse-battery-staple";

  it("accepts the secret as a bearer token", () => {
    expect(isAuthorizedScheduler(`Bearer ${SECRET}`, SECRET)).toBe(true);
    // Header names and schemes are case-insensitive per RFC 9110.
    expect(isAuthorizedScheduler(`bearer ${SECRET}`, SECRET)).toBe(true);
    expect(isAuthorizedScheduler(`  Bearer   ${SECRET}  `, SECRET)).toBe(true);
  });

  it("refuses everything else", () => {
    const rejected: (string | null | undefined)[] = [
      null,
      undefined,
      "",
      SECRET, // the raw secret without the scheme
      `Basic ${SECRET}`,
      "Bearer",
      "Bearer ",
      "Bearer wrong",
      `Bearer ${SECRET.slice(0, -1)}`,
      `Bearer ${SECRET}x`,
      `Bearerx${SECRET}`,
      `Bearer x${SECRET}`,
    ];

    for (const header of rejected) {
      expect(isAuthorizedScheduler(header, SECRET), `expected ${header} to be refused`).toBe(false);
    }
  });

  it("fails closed when the deployment has no secret", () => {
    // Not "let it through": an unconfigured deployment must not expose an endpoint
    // that pushes to everybody.
    expect(isAuthorizedScheduler("Bearer anything", "")).toBe(false);
    expect(isAuthorizedScheduler("Bearer ", "")).toBe(false);
    expect(isAuthorizedScheduler(null, "")).toBe(false);
  });
});

describe("the configured secret", () => {
  const originalKairos = process.env.KAIROS_CRON_SECRET;
  const originalVercel = process.env.CRON_SECRET;

  afterEach(() => {
    if (originalKairos === undefined) delete process.env.KAIROS_CRON_SECRET;
    else process.env.KAIROS_CRON_SECRET = originalKairos;
    if (originalVercel === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = originalVercel;
  });

  it("prefers KAIROS_CRON_SECRET", () => {
    process.env.KAIROS_CRON_SECRET = "kairos-name";
    process.env.CRON_SECRET = "vercel-name";
    expect(schedulerSecret()).toBe("kairos-name");
  });

  it("falls back to Vercel's CRON_SECRET, which is the name Vercel reads", () => {
    delete process.env.KAIROS_CRON_SECRET;
    process.env.CRON_SECRET = "vercel-name";
    expect(schedulerSecret()).toBe("vercel-name");
    // Vercel attaches the header itself when the variable has that exact name.
    expect(isAuthorizedScheduler("Bearer vercel-name")).toBe(true);
  });

  it("treats a blank value as unset", () => {
    process.env.KAIROS_CRON_SECRET = "   ";
    delete process.env.CRON_SECRET;
    expect(schedulerSecret()).toBe("");
    expect(isAuthorizedScheduler("Bearer    ")).toBe(false);
  });
});
