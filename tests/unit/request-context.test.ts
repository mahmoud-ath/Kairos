import { describe, expect, it } from "vitest";

import { asUserId } from "@/lib/ids";
import { buildRequestContext } from "@/lib/request-context";
import type { SettingsRecord } from "@/server/services/settings";

const SETTINGS: SettingsRecord = {
  theme: "system",
  timezone: "Africa/Casablanca",
  weekStartsOn: 1,
  nickname: "Mahmoud",
  avatarId: "spark",
  fontScale: "default",
  reminderHour: 21,
};

describe("the request context", () => {
  it("derives today from the account's timezone, not the server's", () => {
    // 23:30 UTC is already 00:30 the next day in Casablanca (UTC+1, outside Ramadan).
    const now = new Date("2026-10-19T23:30:00.000Z");
    const ctx = buildRequestContext({
      userId: "user-1",
      email: "mahmoud@example.com",
      settings: SETTINGS,
      now,
    });

    expect(ctx.today).toBe("2026-10-20");
    expect(ctx.timeZone).toBe("Africa/Casablanca");
  });

  it("gives two renders at the same instant the same day", () => {
    const now = new Date("2026-10-19T23:59:59.000Z");
    const first = buildRequestContext({ userId: "u", email: null, settings: SETTINGS, now });
    const second = buildRequestContext({ userId: "u", email: null, settings: SETTINGS, now });
    expect(first.today).toBe(second.today);
  });

  it("follows a different timezone for the same instant", () => {
    const now = new Date("2026-10-19T22:30:00.000Z");
    const utc = buildRequestContext({
      userId: "u",
      email: null,
      settings: { ...SETTINGS, timezone: "UTC" },
      now,
    });
    expect(utc.today).toBe("2026-10-19");
  });

  it("carries the settings it was built from", () => {
    const ctx = buildRequestContext({
      userId: "u",
      email: "a@b.c",
      settings: SETTINGS,
      now: new Date("2026-10-19T08:00:00.000Z"),
    });
    expect(ctx.settings.reminderHour).toBe(21);
    expect(ctx.email).toBe("a@b.c");
  });

  it("brands the owner and refuses an empty one", () => {
    const ctx = buildRequestContext({
      userId: "  user-1  ",
      email: null,
      settings: SETTINGS,
      now: new Date("2026-10-19T08:00:00.000Z"),
    });
    expect(ctx.userId).toBe("user-1");
    expect(() => asUserId("   ")).toThrow(/empty/);
  });
});
