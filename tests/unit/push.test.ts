import { describe, expect, it } from "vitest";
import webpush from "web-push";

import { dateOnlyInTimeZone } from "@/lib/dates";
import {
  DEFAULT_REMINDER_HOUR,
  REMINDER_BODY,
  REMINDER_CATCH_UP_HOURS,
  REMINDER_TAG,
  REMINDER_TIME_ZONE,
  REMINDER_TITLE,
  REMINDER_TOPIC,
  REMINDER_TTL_SECONDS,
  REMINDER_URL,
  formatReminderHour,
  isExpiredSubscriptionStatus,
  isReminderHourDue,
  isRetryableDelivery,
  isValidPushEndpoint,
  isValidReminderHour,
  isValidSubscriptionKey,
  isValidVapidKey,
  reminderHourOptions,
  reminderPayload,
  runWithConcurrency,
} from "@/lib/push";

/** Wall-clock time in Morocco, for the scheduling tests. */
function moroccoTime(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: REMINDER_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

describe("the daily reminder", () => {
  it("says exactly this, and never names a task", () => {
    expect(reminderPayload()).toEqual({
      title: "Kairos",
      body: "Check your tasks for tomorrow.",
      url: "/today",
      tag: "kairos-daily-reminder",
    });
    // The payload is shared by every account, so the wording is part of the
    // contract rather than a detail of the UI.
    expect(REMINDER_TITLE).toBe("Kairos");
    expect(REMINDER_BODY).toBe("Check your tasks for tomorrow.");
    expect(REMINDER_URL).toBe("/today");
  });

  it("stays inside the push-service limits", () => {
    // The Topic header is capped at 32 characters by RFC 8030 §5.4.
    expect(REMINDER_TOPIC.length).toBeLessThanOrEqual(32);
    expect(REMINDER_TAG.length).toBeGreaterThan(0);
    // A reminder that could not be delivered expires within the hour, rather than
    // arriving at a random moment later in the day.
    expect(REMINDER_TTL_SECONDS).toBe(60 * 60);
  });
});

describe("push endpoints", () => {
  it("accepts an https endpoint from a push service", () => {
    expect(isValidPushEndpoint("https://fcm.googleapis.com/fcm/send/abc-123")).toBe(true);
    expect(isValidPushEndpoint("https://updates.push.services.mozilla.com/wpush/v2/xyz")).toBe(true);
  });

  it("refuses anything that is not one", () => {
    // Plain http would let a tampered client aim the sender at a host of its own.
    expect(isValidPushEndpoint("http://fcm.googleapis.com/fcm/send/abc")).toBe(false);
    expect(isValidPushEndpoint("not a url")).toBe(false);
    expect(isValidPushEndpoint("https://")).toBe(false);
    expect(isValidPushEndpoint("mailto:me@example.com")).toBe(false);
    expect(isValidPushEndpoint(`https://example.test/${"a".repeat(3000)}`)).toBe(false);
    expect(isValidPushEndpoint("")).toBe(false);
    expect(isValidPushEndpoint(null)).toBe(false);
    expect(isValidPushEndpoint(42)).toBe(false);
  });
});

describe("device keys", () => {
  const keys = webpush.generateVAPIDKeys();

  it("accepts the shapes a browser produces", () => {
    // A P-256 public point is 65 bytes: the same shape as the key below.
    expect(isValidSubscriptionKey(keys.publicKey, "p256dh")).toBe(true);
    expect(isValidSubscriptionKey("A".repeat(22), "auth")).toBe(true);
    // Padding is allowed: encoders differ.
    expect(isValidSubscriptionKey(`${"A".repeat(42)}==`, "auth")).toBe(true);
  });

  it("refuses a truncated or malformed value", () => {
    expect(isValidSubscriptionKey(keys.publicKey.slice(0, 20), "p256dh")).toBe(false);
    expect(isValidSubscriptionKey("A".repeat(4), "auth")).toBe(false);
    expect(isValidSubscriptionKey("has spaces in it", "auth")).toBe(false);
    expect(isValidSubscriptionKey("not base64!!", "p256dh")).toBe(false);
    expect(isValidSubscriptionKey("", "p256dh")).toBe(false);
    expect(isValidSubscriptionKey(undefined, "auth")).toBe(false);
  });
});

describe("VAPID keys", () => {
  it("accepts a generated pair", () => {
    const keys = webpush.generateVAPIDKeys();
    expect(isValidVapidKey(keys.publicKey, "public")).toBe(true);
    expect(isValidVapidKey(keys.privateKey, "private")).toBe(true);
  });

  it("rejects a truncated paste, so it reads as unconfigured", () => {
    const keys = webpush.generateVAPIDKeys();
    expect(isValidVapidKey(keys.publicKey.slice(0, 40), "public")).toBe(false);
    expect(isValidVapidKey(keys.privateKey.slice(0, 20), "private")).toBe(false);
    expect(isValidVapidKey(keys.publicKey, "private")).toBe(false);
    expect(isValidVapidKey("", "public")).toBe(false);
    expect(isValidVapidKey(null, "private")).toBe(false);
  });
});

describe("delivery outcomes", () => {
  it("treats 404 and 410 as a subscription that is gone for good", () => {
    expect(isExpiredSubscriptionStatus(404)).toBe(true);
    expect(isExpiredSubscriptionStatus(410)).toBe(true);
  });

  it("treats everything else as transient, so the device is kept", () => {
    for (const status of [undefined, 0, 400, 401, 413, 429, 500, 502, 503]) {
      expect(isExpiredSubscriptionStatus(status)).toBe(false);
      expect(isRetryableDelivery(status)).toBe(true);
    }
    expect(isRetryableDelivery(404)).toBe(false);
    expect(isRetryableDelivery(410)).toBe(false);
  });
});

describe("the hour an account chooses", () => {
  it("is due at its hour and for a couple of hours after", () => {
    expect(DEFAULT_REMINDER_HOUR).toBe(1);
    expect(isReminderHourDue(1, 1)).toBe(true);
    // The scheduler may run late, or skip the hour entirely: the window is what
    // turns a missed run into a late reminder instead of a missing one.
    expect(isReminderHourDue(1 + REMINDER_CATCH_UP_HOURS, 1)).toBe(true);
    expect(isReminderHourDue(2 + REMINDER_CATCH_UP_HOURS, 1)).toBe(false);
  });

  it("never delivers before the chosen hour", () => {
    expect(isReminderHourDue(0, 1)).toBe(false);
    expect(isReminderHourDue(3, 20)).toBe(false);
    expect(isReminderHourDue(22, 23)).toBe(false);
  });

  it("handles the edges of the day without wrapping", () => {
    expect(isReminderHourDue(23, 23)).toBe(true);
    expect(isReminderHourDue(0, 0)).toBe(true);
    // The window is deliberately monotone and never wraps past midnight: an hour
    // 23 reminder delivered at 00:30 would be claimed against the *next* local
    // date, which would then suppress that day's evening reminder.
    expect(isReminderHourDue(23, 0)).toBe(false);
    expect(isReminderHourDue(0, 23)).toBe(false);
    expect(isReminderHourDue(1, 23)).toBe(false);
  });

  it("refuses anything that is not an hour of the day", () => {
    expect(isReminderHourDue(24, 1)).toBe(false);
    expect(isReminderHourDue(-1, 1)).toBe(false);
    expect(isReminderHourDue(1.5, 1)).toBe(false);
    expect(isReminderHourDue(Number.NaN, 1)).toBe(false);
    expect(isReminderHourDue(1, 24)).toBe(false);

    expect(isValidReminderHour(0)).toBe(true);
    expect(isValidReminderHour(23)).toBe(true);
    expect(isValidReminderHour(24)).toBe(false);
    expect(isValidReminderHour(-1)).toBe(false);
    expect(isValidReminderHour(6.5)).toBe(false);
    expect(isValidReminderHour("6")).toBe(false);
    expect(isValidReminderHour(null)).toBe(false);
  });

  it("offers every hour, labelled the way the panel writes it", () => {
    const options = reminderHourOptions();
    expect(options).toHaveLength(24);
    expect(options[0]).toBe(0);
    expect(options[23]).toBe(23);

    expect(formatReminderHour(0)).toBe("12:00 AM");
    expect(formatReminderHour(1)).toBe("1:00 AM");
    expect(formatReminderHour(12)).toBe("12:00 PM");
    expect(formatReminderHour(20)).toBe("8:00 PM");
    expect(formatReminderHour(23)).toBe("11:00 PM");
    expect(formatReminderHour(24)).toBe("—");
  });
});

describe("bounded concurrency", () => {
  it("runs every item exactly once", async () => {
    const seen: number[] = [];
    const items = Array.from({ length: 23 }, (_, index) => index);

    await runWithConcurrency(items, 4, async (item) => {
      await new Promise((resolve) => setTimeout(resolve, 1));
      seen.push(item);
    });

    expect(seen).toHaveLength(items.length);
    expect([...seen].sort((a, b) => a - b)).toEqual(items);
  });

  it("never has more than the limit in flight", async () => {
    let inFlight = 0;
    let peak = 0;

    await runWithConcurrency(Array.from({ length: 25 }, (_, index) => index), 3, async () => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 1));
      inFlight -= 1;
    });

    expect(peak).toBeLessThanOrEqual(3);
    // If it were sequential the peak would be 1, which would make the test pass
    // for the wrong reason.
    expect(peak).toBeGreaterThan(1);
  });

  it("copes with an empty list and an oversized limit", async () => {
    await expect(runWithConcurrency([], 4, async () => {})).resolves.toBeUndefined();

    const seen: string[] = [];
    await runWithConcurrency(["a", "b"], 99, async (item) => {
      seen.push(item);
    });
    expect(seen).toEqual(["a", "b"]);
  });
});

/**
 * These cases assert the real IANA rules for Africa/Casablanca, which changed in
 * 2018 (permanent UTC+1 with a UTC+0 dip during Ramadan) and have been amended
 * since. Slim CI images can ship a tz database old enough to answer UTC+0 for
 * October 2026, which is not a bug in our code — so the block is skipped on a
 * runner that cannot represent the current rules, and the generic zone handling
 * is covered by the fixed-offset tests below.
 */
const MODERN_MOROCCO_RULES =
  dateOnlyInTimeZone(new Date("2026-10-14T23:30:00Z"), REMINDER_TIME_ZONE) === "2026-10-15";

describe.skipIf(!MODERN_MOROCCO_RULES)("the Morocco calendar date", () => {
  it("uses the offset Casablanca actually has, not a fixed UTC+1", () => {
    // Normal time: UTC+1, so late-evening UTC is already tomorrow locally.
    expect(dateOnlyInTimeZone(new Date("2026-10-14T23:30:00Z"), REMINDER_TIME_ZONE)).toBe(
      "2026-10-15",
    );
    // Ramadan: Morocco drops back to UTC+0, so the same UTC instant stays today.
    expect(dateOnlyInTimeZone(new Date("2027-02-14T23:30:00Z"), REMINDER_TIME_ZONE)).toBe(
      "2027-02-14",
    );
    // And back to UTC+1 afterwards.
    expect(dateOnlyInTimeZone(new Date("2027-03-20T23:30:00Z"), REMINDER_TIME_ZONE)).toBe(
      "2027-03-21",
    );
  });

  it("gives the same reminder date for the whole hour the job can run in", () => {
    // Vercel Hobby may fire anywhere inside the scheduled UTC hour, so every
    // minute of it has to resolve to the same day — otherwise duplicate
    // prevention would disagree with itself.
    const dates = new Set(
      Array.from({ length: 60 }, (_, minute) =>
        dateOnlyInTimeZone(
          new Date(Date.UTC(2026, 9, 14, 0, minute, 30)),
          REMINDER_TIME_ZONE,
        ),
      ),
    );
    expect([...dates]).toEqual(["2026-10-14"]);
  });

  it("is why a fixed UTC cron expression cannot always be 01:00 locally", () => {
    // `0 0 * * *` UTC is what vercel.json asks for.
    expect(moroccoTime("2026-10-14T00:00:00Z")).toBe("01:00"); // UTC+1 → 01:00 ✓
    expect(moroccoTime("2027-02-14T00:00:00Z")).toBe("00:00"); // UTC+0 → 00:00, an hour early
  });
});

describe("the reminder date in a fixed-offset zone", () => {
  // Always-on counterpart to the block above: fixed offsets are in every tz
  // database ever shipped, so this keeps the date/offset logic covered even when
  // the runner cannot represent Casablanca's current rules.
  it("rolls over at local midnight, not UTC midnight", () => {
    // UTC+1: 23:30Z is already 00:30 tomorrow.
    expect(dateOnlyInTimeZone(new Date("2026-10-14T23:30:00Z"), "Etc/GMT-1")).toBe("2026-10-15");
    // UTC-5: 03:30Z is still 22:30 yesterday.
    expect(dateOnlyInTimeZone(new Date("2026-10-14T03:30:00Z"), "Etc/GMT+5")).toBe("2026-10-13");
    // UTC: the boundary itself belongs to the new day.
    expect(dateOnlyInTimeZone(new Date("2026-10-14T00:00:00Z"), "UTC")).toBe("2026-10-14");
  });
});
