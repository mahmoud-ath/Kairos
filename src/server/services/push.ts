import "server-only";

import webpush from "web-push";

import { DEFAULT_TIMEZONE } from "@/lib/constants";
import { dateOnlyInTimeZone, hourInTimeZone } from "@/lib/dates";
import {
  DEFAULT_REMINDER_HOUR,
  REMINDER_CONCURRENCY,
  REMINDER_TIME_ZONE,
  REMINDER_TTL_SECONDS,
  REMINDER_TOPIC,
  isExpiredSubscriptionStatus,
  isReminderHourDue,
  isValidPushEndpoint,
  isValidSubscriptionKey,
  isValidVapidKey,
  reminderPayload,
  runWithConcurrency,
  type ReminderPayload,
} from "@/lib/push";
import { prisma, scopedPrisma } from "@/server/db";
import { ServiceError } from "@/server/services/tasks";

/**
 * The daily reminder: device registration, and the one job that sends it.
 *
 * Everything here is deliberately small in scope. There are no per-task
 * reminders, nothing is written to a task, and the broadcast reads exactly one
 * table — the list of devices. The payload is the same generic sentence for
 * everybody.
 */

/** A device, as the settings panel sees it. */
export type PushDevice = {
  id: string;
  endpoint: string;
  lastSentDate: string | null;
  createdAt: Date;
};

/** A device plus the keys needed to encrypt a payload to it. */
export type Subscriber = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

export type BroadcastSummary = {
  /** When the run happened (ISO), for the log line. */
  at: string;
  /** The timezone the run itself is reported in — the reminder's home. */
  reference: string;
  referenceDate: string;
  referenceHour: number;
  /** Devices this invocation claimed for their local date. */
  candidates: number;
  /** Devices whose chosen hour has not arrived yet, so they were left alone. */
  waiting: number;
  sent: number;
  failed: number;
  removed: number;
  /** Devices another invocation had already claimed. */
  skipped: number;
};

/** Raised when a push service answers with a status. */
export class PushDeliveryError extends Error {
  readonly statusCode: number | undefined;

  constructor(statusCode: number | undefined) {
    super(
      statusCode === undefined
        ? "The push service could not be reached."
        : `The push service responded with ${statusCode}.`,
    );
    this.name = "PushDeliveryError";
    this.statusCode = statusCode;
  }
}

/* -------------------------------------------------------------------------- */
/* Configuration                                                              */
/* -------------------------------------------------------------------------- */

export type VapidConfig = { publicKey: string; privateKey: string; subject: string };

/**
 * VAPID settings, or `null` when this deployment has none.
 *
 * Read per call rather than cached at module load: a serverless instance is
 * reused, so a `null` remembered from a cold start would keep notifications
 * switched off for the rest of that instance's life after the variables were set.
 * The key *shapes* are checked too, so a truncated paste reads as "not
 * configured" instead of failing later with an opaque 4xx from the push service.
 */
export function vapidConfig(): VapidConfig | null {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() ?? "";
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim() ?? "";
  const subject = process.env.VAPID_SUBJECT?.trim() ?? "";
  if (!isValidVapidKey(publicKey, "public") || !isValidVapidKey(privateKey, "private")) {
    return null;
  }
  if (!subject) return null;
  return { publicKey, privateKey, subject };
}

export function isPushConfigured(): boolean {
  return vapidConfig() !== null;
}

/* -------------------------------------------------------------------------- */
/* Delivery                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Send one payload to one device.
 *
 * The endpoint and the keys are never logged: an endpoint is a capability URL,
 * and the keys are what the payload is encrypted with. Failures are reported by
 * status code alone.
 */
async function deliver(subscriber: Subscriber, payload: ReminderPayload): Promise<void> {
  const config = vapidConfig();
  if (!config) {
    throw new ServiceError("Notifications are not configured on this deployment.");
  }

  webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey);

  try {
    await webpush.sendNotification(
      {
        endpoint: subscriber.endpoint,
        keys: { p256dh: subscriber.p256dh, auth: subscriber.auth },
      },
      JSON.stringify(payload),
      {
        // A reminder that could not be delivered straight away expires within the
        // hour, rather than surfacing at random later in the day.
        TTL: REMINDER_TTL_SECONDS,
        urgency: "normal",
        topic: REMINDER_TOPIC,
      },
    );
  } catch (error) {
    const status = (error as { statusCode?: unknown }).statusCode;
    throw new PushDeliveryError(typeof status === "number" ? status : undefined);
  }
}

/* -------------------------------------------------------------------------- */
/* Device registration                                                        */
/* -------------------------------------------------------------------------- */

function toDevice(row: {
  id: string;
  endpoint: string;
  lastSentDate: string | null;
  createdAt: Date;
}): PushDevice {
  return {
    id: row.id,
    endpoint: row.endpoint,
    lastSentDate: row.lastSentDate,
    createdAt: row.createdAt,
  };
}

/** The devices this account has switched the reminder on for. */
export async function listDevices(userId: string): Promise<PushDevice[]> {
  const prisma = scopedPrisma(userId);
  const rows = await prisma.pushSubscription.findMany({ orderBy: [{ createdAt: "asc" }] });
  return rows.map(toDevice);
}

/**
 * How many devices this account has switched the reminder on for.
 *
 * The settings panel only needs the total: the endpoint of *this* device comes
 * from the browser, and there is no reason to send every endpoint of the account
 * across to the client for a sentence like "2 devices".
 */
export async function countDevices(userId: string): Promise<number> {
  const prisma = scopedPrisma(userId);
  return prisma.pushSubscription.count();
}

/**
 * Register (or refresh) this device for the signed-in account.
 *
 * `endpoint` is unique across the whole table, so this is an upsert keyed on it:
 * when the same device signs in as another account and switches the reminder on
 * again, its row is **handed over** rather than duplicated. Duplicating would
 * deliver every reminder twice, once to an account that has already stopped
 * asking for it.
 *
 * This is the one write in the codebase that uses the unscoped client, and
 * deliberately so: the scoping layer would (correctly) refuse to touch a row
 * owned by somebody else, which would turn a legitimate change of account into a
 * unique-constraint error. It is still not a hole — the owner comes from the
 * verified session and never from the request, the row is addressed by an
 * endpoint the caller's own browser just issued, and both the create and the
 * update name the owner explicitly, so the write stays auditable.
 */
export async function subscribeDevice(
  userId: string,
  input: { endpoint: string; p256dh: string; auth: string },
): Promise<PushDevice> {
  if (
    !isValidPushEndpoint(input.endpoint) ||
    !isValidSubscriptionKey(input.p256dh, "p256dh") ||
    !isValidSubscriptionKey(input.auth, "auth")
  ) {
    throw new ServiceError("That notification subscription is not valid.");
  }

  const row = await prisma.pushSubscription.upsert({
    where: { endpoint: input.endpoint },
    create: {
      userId,
      endpoint: input.endpoint,
      p256dh: input.p256dh,
      auth: input.auth,
    },
    update: {
      userId,
      p256dh: input.p256dh,
      auth: input.auth,
      // A device that has just been switched on should not be skipped because its
      // previous owner was already served today.
      lastSentDate: null,
    },
  });

  return toDevice(row);
}

/**
 * Stop sending to one device.
 *
 * Scoped like every other delete: the filter is the caller's own `userId`, so
 * asking for somebody else's endpoint simply matches no row.
 */
export async function unsubscribeDevice(userId: string, endpoint: string): Promise<boolean> {
  if (!isValidPushEndpoint(endpoint)) return false;
  const prisma = scopedPrisma(userId);
  const result = await prisma.pushSubscription.deleteMany({ where: { endpoint } });
  return result.count > 0;
}

/**
 * Send the reminder to one of the account's own devices, so the whole path —
 * keys, push service, service worker, notification — can be tried without
 * waiting for the nightly run.
 */
export async function sendTestToDevice(userId: string, endpoint: string): Promise<void> {
  if (!isValidPushEndpoint(endpoint)) {
    throw new ServiceError("That notification subscription is not valid.");
  }

  const prisma = scopedPrisma(userId);
  // Scoped lookup: another account's endpoint is invisible here, so this cannot
  // be used to push to somebody else's device.
  const device = await prisma.pushSubscription.findFirst({ where: { endpoint } });
  if (!device) {
    throw new ServiceError("This device is not subscribed to notifications.");
  }

  await deliver(
    { id: device.id, endpoint: device.endpoint, p256dh: device.p256dh, auth: device.auth },
    reminderPayload(),
  );
}

/* -------------------------------------------------------------------------- */
/* The daily broadcast                                                        */
/* -------------------------------------------------------------------------- */

type ClaimedSubscriber = Subscriber & {
  /** The device's last successful reminder date, restored if the send fails. */
  previousDate: string | null;
  /** The device's own calendar date, which the claim was written against. */
  localDate: string;
};

/** The hour and date an account is living in, read from its own settings. */
type AccountClock = { timeZone: string; reminderHour: number };

const FALLBACK_CLOCK: AccountClock = {
  timeZone: DEFAULT_TIMEZONE,
  reminderHour: DEFAULT_REMINDER_HOUR,
};

/**
 * Send the due reminder to every subscribed device.
 *
 * One shared job serves everybody, so it has to answer two questions per device:
 * *has this account's chosen hour arrived* (compared against the account's own
 * timezone, never the server's) and *has this device already been reminded for
 * its own calendar date*. A device is **claimed** for its date before the send —
 * a conditional update, so two overlapping invocations cannot both deliver — and
 * the claim is handed back if the failure looks transient, which leaves the
 * device eligible for a retry later that day.
 *
 * Delivery is therefore **at most once per device per local day, at or shortly
 * after the chosen hour — never exactly once.** Vercel documents cron delivery as
 * best effort: an invocation can be repeated, or missed entirely, which is why
 * the window is `REMINDER_CATCH_UP_HOURS` wide instead of a single minute.
 *
 * The `sender` is injectable so the integration suite can exercise claiming,
 * duplicate prevention, hour matching and cleanup without a push service.
 */
export async function broadcastDailyReminder(
  options: {
    now?: Date;
    sender?: (subscriber: Subscriber, payload: ReminderPayload) => Promise<void>;
  } = {},
): Promise<BroadcastSummary> {
  const config = vapidConfig();
  if (!config) {
    throw new ServiceError("Notifications are not configured on this deployment.");
  }

  const now = options.now ?? new Date();
  const send = options.sender ?? deliver;
  const payload = reminderPayload();

  const referenceDate = dateOnlyInTimeZone(now, REMINDER_TIME_ZONE);
  const referenceHour = hourInTimeZone(now, REMINDER_TIME_ZONE);

  // The one read in the app that is deliberately not tenant-scoped: the reminder
  // is a single shared job, so it has to consider every account. It selects only
  // what delivery needs, and the rows never leave this function. There is no date
  // filter in SQL because "already reminded today" is a question only the owner's
  // own timezone can answer — and the table holds one row per device by design.
  const subscriptions = await prisma.pushSubscription.findMany({
    select: {
      id: true,
      userId: true,
      endpoint: true,
      p256dh: true,
      auth: true,
      lastSentDate: true,
    },
    orderBy: { createdAt: "asc" },
  });

  // Each account's hour and timezone. One extra read, not one per device: an
  // account with three phones should still cost a single lookup.
  const owners = [...new Set(subscriptions.map((row) => row.userId))];
  const settings = owners.length
    ? await prisma.settings.findMany({
        where: { userId: { in: owners } },
        select: { userId: true, timezone: true, reminderHour: true },
      })
    : [];
  const clocks = new Map<string, AccountClock>(
    settings.map((row) => [
      row.userId,
      { timeZone: row.timezone, reminderHour: row.reminderHour },
    ]),
  );

  const claimed: ClaimedSubscriber[] = [];
  let waiting = 0;
  let skipped = 0;

  for (const subscription of subscriptions) {
    const clock = clocks.get(subscription.userId) ?? FALLBACK_CLOCK;

    // The device's own day and hour, not the server's.
    const localDate = dateOnlyInTimeZone(now, clock.timeZone);
    const localHour = hourInTimeZone(now, clock.timeZone);

    if (subscription.lastSentDate === localDate) continue;
    if (!isReminderHourDue(localHour, clock.reminderHour)) {
      waiting += 1;
      continue;
    }

    const result = await prisma.pushSubscription.updateMany({
      where: {
        id: subscription.id,
        OR: [{ lastSentDate: null }, { lastSentDate: { not: localDate } }],
      },
      data: { lastSentDate: localDate },
    });

    if (result.count === 0) {
      // Another invocation claimed this device first.
      skipped += 1;
      continue;
    }

    claimed.push({
      id: subscription.id,
      endpoint: subscription.endpoint,
      p256dh: subscription.p256dh,
      auth: subscription.auth,
      previousDate: subscription.lastSentDate,
      localDate,
    });
  }

  let sent = 0;
  let failed = 0;
  let removed = 0;

  await runWithConcurrency(claimed, REMINDER_CONCURRENCY, async (subscriber) => {
    try {
      await send(subscriber, payload);
      sent += 1;
    } catch (error) {
      const status = error instanceof PushDeliveryError ? error.statusCode : undefined;

      if (isExpiredSubscriptionStatus(status)) {
        // The browser profile is gone or notifications were revoked: the row will
        // never work again, so it is deleted rather than retried forever.
        await prisma.pushSubscription.deleteMany({ where: { id: subscriber.id } });
        removed += 1;
        console.warn("[kairos] dropped an expired push subscription", {
          subscriptionId: subscriber.id,
          status,
        });
        return;
      }

      // Transient — a timeout, a 429, a 5xx, or no status at all. Hand the day
      // back so a later invocation can try this device again.
      failed += 1;
      await prisma.pushSubscription.updateMany({
        where: { id: subscriber.id, lastSentDate: subscriber.localDate },
        data: { lastSentDate: subscriber.previousDate },
      });
      console.warn("[kairos] push delivery failed; retry left possible", {
        subscriptionId: subscriber.id,
        status: status ?? "no-status",
      });
    }
  });

  return {
    at: now.toISOString(),
    reference: REMINDER_TIME_ZONE,
    referenceDate,
    referenceHour,
    candidates: claimed.length,
    waiting,
    sent,
    failed,
    removed,
    skipped,
  };
}
