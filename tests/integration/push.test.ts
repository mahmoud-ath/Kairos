import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import webpush from "web-push";

import { dateOnlyInTimeZone } from "@/lib/dates";
import { REMINDER_TIME_ZONE } from "@/lib/push";
import { prisma, scopedPrisma } from "@/server/db";
import { resetAllData } from "@/server/services/backup";
import { updateSettings } from "@/server/services/settings";
import {
  PushDeliveryError,
  broadcastDailyReminder,
  countDevices,
  listDevices,
  sendTestToDevice,
  subscribeDevice,
  unsubscribeDevice,
} from "@/server/services/push";

/**
 * The parts of the daily reminder that live in the database: who owns a device,
 * whether a device is reminded once a day or twice, and what happens when a push
 * service says a subscription is gone.
 *
 * Delivery itself is always injectable, so no test here talks to a real push
 * service — the only network-free way to assert what *would* have been sent.
 *
 * Both tenants use random ids and the suite cleans up after itself, so it is safe
 * against a development database. The broadcast is deliberately global (one
 * shared schedule), so subscriptions that are already in the database are
 * snapshotted and restored: this suite must not decide whether somebody else's
 * device was reminded today.
 */
const alice = `test-push-alice-${randomUUID()}`;
const bob = `test-push-bob-${randomUUID()}`;

/** Every endpoint this suite creates, so its own rows can be told apart. */
const PREFIX = "https://push.example.test/";

/** The timezone the tests reason in — the reminder's home, and UTC+1 outside Ramadan. */
const CASABLANCA = "Africa/Casablanca";

const vapid = webpush.generateVAPIDKeys();
/** Same shape as a real device key, and never used to encrypt anything here. */
const p256dh = vapid.publicKey;
const auth = "abcdefghijklmnopqrstuv";

function device(name: string) {
  return { endpoint: `${PREFIX}${name}-${randomUUID()}`, p256dh, auth };
}

async function wipe(userId: string) {
  await scopedPrisma(userId).pushSubscription.deleteMany();
}

let foreignRows: { id: string; lastSentDate: string | null }[] = [];

beforeAll(async () => {
  // The service reads the VAPID pair on every call, so the suite supplies its own
  // rather than depending on whatever `.env` happens to hold.
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = vapid.publicKey;
  process.env.VAPID_PRIVATE_KEY = vapid.privateKey;
  process.env.VAPID_SUBJECT = "mailto:integration@kairos.test";

  await wipe(alice);
  await wipe(bob);

  foreignRows = await prisma.pushSubscription.findMany({
    where: { NOT: { endpoint: { startsWith: PREFIX } } },
    select: { id: true, lastSentDate: true },
  });
});

afterAll(async () => {
  for (const row of foreignRows) {
    await prisma.pushSubscription.updateMany({
      where: { id: row.id },
      data: { lastSentDate: row.lastSentDate },
    });
  }
  await wipe(alice);
  await wipe(bob);
  // The reminder reads each account's timezone and chosen hour, so these tests
  // leave settings rows behind unless they are cleared as well.
  await scopedPrisma(alice).settings.deleteMany();
  await scopedPrisma(bob).settings.deleteMany();
});

/**
 * Every test starts with both tenants owning no devices, and living in a known
 * timezone with a known reminder hour.
 *
 * The broadcast is global by design, so a row left behind by the previous test
 * would turn up in the next one's deliveries — and *when* a device is reminded is
 * decided by its owner's clock, which therefore has to be stated, not assumed.
 */
beforeEach(async () => {
  await wipe(alice);
  await wipe(bob);
  await updateSettings(alice, { timezone: CASABLANCA, reminderHour: 1 });
  await updateSettings(bob, { timezone: CASABLANCA, reminderHour: 1 });
});

describe("device ownership", () => {
  it("gives a device to the account that registered it", async () => {
    const aliceDevice = device("alice");
    const bobDevice = device("bob");

    await subscribeDevice(alice, aliceDevice);
    await subscribeDevice(bob, bobDevice);

    expect((await listDevices(alice)).map((entry) => entry.endpoint)).toEqual([
      aliceDevice.endpoint,
    ]);
    expect(await countDevices(alice)).toBe(1);
    expect(await countDevices(bob)).toBe(1);
  });

  it("cannot unsubscribe another account's device", async () => {
    const aliceDevice = device("alice");
    await subscribeDevice(alice, aliceDevice);

    // Bob names Alice's endpoint: the owner filter means this matches no row.
    expect(await unsubscribeDevice(bob, aliceDevice.endpoint)).toBe(false);
    expect((await listDevices(alice)).map((entry) => entry.endpoint)).toContain(
      aliceDevice.endpoint,
    );

    // Its owner can.
    expect(await unsubscribeDevice(alice, aliceDevice.endpoint)).toBe(true);
    expect(await countDevices(alice)).toBe(0);
  });

  it("cannot send a test notification to another account's device", async () => {
    const aliceDevice = device("alice");
    await subscribeDevice(alice, aliceDevice);

    // Refused before any delivery is attempted, because the scoped lookup cannot
    // see a row that belongs to somebody else.
    await expect(sendTestToDevice(bob, aliceDevice.endpoint)).rejects.toThrow(/not subscribed/i);

    await unsubscribeDevice(alice, aliceDevice.endpoint);
  });

  it("hands the device over instead of duplicating it when the account changes", async () => {
    const shared = device("shared");
    await subscribeDevice(alice, shared);
    await subscribeDevice(bob, shared);

    // Two rows for one endpoint would deliver every reminder twice — the second
    // one to an account that had already switched it off.
    expect(await scopedPrisma(alice).pushSubscription.count()).toBe(0);
    expect(await scopedPrisma(bob).pushSubscription.count()).toBe(1);
  });

  it("refuses a subscription that is not shaped like one", async () => {
    await expect(
      subscribeDevice(alice, { endpoint: "http://plain.test/device", p256dh, auth }),
    ).rejects.toThrow(/not valid/i);
    await expect(
      subscribeDevice(alice, { endpoint: `${PREFIX}broken`, p256dh: "too-short", auth }),
    ).rejects.toThrow(/not valid/i);
    await expect(
      subscribeDevice(alice, { endpoint: `${PREFIX}broken`, p256dh, auth: "" }),
    ).rejects.toThrow(/not valid/i);
  });
});

describe("the daily broadcast", () => {
  it("reminds each device once per local day", async () => {
    const first = device("one");
    const second = device("two");
    await subscribeDevice(alice, first);
    await subscribeDevice(alice, second);

    const delivered: string[] = [];
    const sender = async (subscriber: { endpoint: string }) => {
      delivered.push(subscriber.endpoint);
    };
    const mine = () => delivered.filter((endpoint) => endpoint.startsWith(PREFIX));

    const now = new Date("2026-10-14T00:05:00Z");
    const summary = await broadcastDailyReminder({ now, sender });

    // 00:05 UTC is 01:05 in Casablanca, which is the hour these accounts chose.
    expect(summary.reference).toBe(REMINDER_TIME_ZONE);
    expect(summary.referenceDate).toBe(dateOnlyInTimeZone(now, REMINDER_TIME_ZONE));
    expect(summary.referenceDate).toBe("2026-10-14");
    expect(summary.referenceHour).toBe(1);
    expect(mine().sort()).toEqual([first.endpoint, second.endpoint].sort());

    // A second invocation the same day — Vercel documents cron delivery as best
    // effort, and a retry can land next to the scheduled run — delivers nothing.
    await broadcastDailyReminder({ now, sender });
    expect(mine()).toHaveLength(2);

    // 23:05 UTC on the 14th is 00:05 on the 15th in Casablanca, but hour 0 is an
    // hour *before* the chosen hour, so the new day is not due yet…
    const tooEarly = await broadcastDailyReminder({
      now: new Date("2026-10-14T23:05:00Z"),
      sender,
    });
    expect(tooEarly.waiting).toBeGreaterThanOrEqual(2);
    expect(mine()).toHaveLength(2);

    // …and 01:05 on the 15th delivers the new day's reminder.
    await broadcastDailyReminder({ now: new Date("2026-10-15T00:05:00Z"), sender });
    expect(mine()).toHaveLength(4);
  });

  it("drops a device the push service reports as gone", async () => {
    const gone = device("gone");
    const stays = device("stays");
    await subscribeDevice(alice, gone);
    await subscribeDevice(alice, stays);

    const summary = await broadcastDailyReminder({
      now: new Date("2026-10-20T00:05:00Z"),
      sender: async (subscriber) => {
        if (subscriber.endpoint === gone.endpoint) throw new PushDeliveryError(410);
      },
    });

    expect(summary.removed).toBeGreaterThanOrEqual(1);
    expect(await countDevices(alice)).toBe(1);
    expect((await listDevices(alice))[0].endpoint).toBe(stays.endpoint);
  });

  it("keeps the device and the day when delivery fails transiently", async () => {
    const flaky = device("flaky");
    await subscribeDevice(alice, flaky);

    const now = new Date("2026-10-25T00:05:00Z");
    const failed = await broadcastDailyReminder({
      now,
      sender: async () => {
        throw new PushDeliveryError(503);
      },
    });
    expect(failed.failed).toBeGreaterThanOrEqual(1);

    // The device is kept…
    expect((await listDevices(alice)).map((entry) => entry.endpoint)).toContain(flaky.endpoint);
    // …and the day is handed back, so a later run can still deliver it.
    const row = await scopedPrisma(alice).pushSubscription.findFirst({
      where: { endpoint: flaky.endpoint },
    });
    expect(row?.lastSentDate).toBeNull();

    const delivered: string[] = [];
    await broadcastDailyReminder({
      now,
      sender: async (subscriber) => {
        delivered.push(subscriber.endpoint);
      },
    });
    expect(delivered).toContain(flaky.endpoint);
  });

  it("refuses to run when Web Push is not configured", async () => {
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    delete process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    try {
      await expect(broadcastDailyReminder()).rejects.toThrow(/not configured/i);
    } finally {
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = publicKey;
    }
  });
});

describe("the account's own clock", () => {
  it("waits for the hour the account chose", async () => {
    await updateSettings(alice, { timezone: CASABLANCA, reminderHour: 20 });
    const evening = device("evening");
    await subscribeDevice(alice, evening);

    const delivered: string[] = [];
    const sender = async (subscriber: { endpoint: string }) => {
      delivered.push(subscriber.endpoint);
    };

    // 01:05 in Casablanca: the default hour, but not this account's.
    const overnight = await broadcastDailyReminder({
      now: new Date("2026-10-14T00:05:00Z"),
      sender,
    });
    expect(overnight.waiting).toBeGreaterThanOrEqual(1);
    expect(delivered).not.toContain(evening.endpoint);

    // 20:05 in Casablanca.
    const atEight = await broadcastDailyReminder({
      now: new Date("2026-10-14T19:05:00Z"),
      sender,
    });
    expect(atEight.sent).toBeGreaterThanOrEqual(1);
    expect(delivered).toContain(evening.endpoint);
  });

  it("reads the hour in the account's timezone, not the server's", async () => {
    await updateSettings(alice, { timezone: "UTC", reminderHour: 22 });
    await updateSettings(bob, { timezone: CASABLANCA, reminderHour: 22 });

    const aliceDevice = device("utc");
    const bobDevice = device("casablanca");
    await subscribeDevice(alice, aliceDevice);
    await subscribeDevice(bob, bobDevice);

    const delivered: string[] = [];
    await broadcastDailyReminder({
      now: new Date("2026-10-14T21:05:00Z"),
      sender: async (subscriber) => {
        delivered.push(subscriber.endpoint);
      },
    });

    // 21:05 UTC is 21:00 for Alice — not yet — and 22:00 for Bob, which is the
    // hour he asked for. The same instant is two different hours.
    expect(delivered).toContain(bobDevice.endpoint);
    expect(delivered).not.toContain(aliceDevice.endpoint);
  });

  it("gives a missed hour a couple of hours of slack, but only once", async () => {
    await updateSettings(alice, { timezone: CASABLANCA, reminderHour: 6 });
    const deviceOne = device("catch-up");
    await subscribeDevice(alice, deviceOne);

    const delivered: string[] = [];
    const sender = async (subscriber: { endpoint: string }) => {
      delivered.push(subscriber.endpoint);
    };
    const mine = () => delivered.filter((endpoint) => endpoint === deviceOne.endpoint);

    // 08:05 in Casablanca: the 06:00 run never happened, so this one catches up.
    await broadcastDailyReminder({ now: new Date("2026-10-14T07:05:00Z"), sender });
    expect(mine()).toHaveLength(1);

    // 08:30 the same local day — still inside the window, so the claim is what
    // stops a second reminder, not the hour.
    await broadcastDailyReminder({ now: new Date("2026-10-14T07:30:00Z"), sender });
    expect(mine()).toHaveLength(1);
  });
});

describe("resetting a workspace", () => {
  it("forgets the account's devices as well as its tasks", async () => {
    await subscribeDevice(alice, device("reset"));
    expect(await countDevices(alice)).toBe(1);

    await resetAllData(alice);

    // Otherwise a phone would keep receiving a reminder about a workspace that
    // has been emptied.
    expect(await countDevices(alice)).toBe(0);
  });
});
