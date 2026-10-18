/**
 * Daily reminder rules.
 *
 * Pure and dependency-free, because the same values are needed in three places:
 * the settings panel in the browser, the server-side sender, and the tests.
 * `public/sw.js` cannot import them — a service worker is served as a plain file
 * — so the few fallbacks it needs are repeated there, with a pointer back here.
 *
 * The reminder is deliberately generic: one shared daily schedule for every
 * account, which never names a task and never reads the database beyond the list
 * of devices to notify.
 */

/** The reminder's own timezone. Morocco is UTC+1 except during Ramadan (UTC+0). */
export const REMINDER_TIME_ZONE = "Africa/Casablanca";

/** Where a tapped notification lands. */
export const REMINDER_URL = "/today";

/** Shown exactly like this. */
export const REMINDER_TITLE = "Kairos";
export const REMINDER_BODY = "Check your tasks for tomorrow.";

/**
 * A stable tag. Android replaces a notification carrying the same tag, so a
 * duplicate delivery — two overlapping invocations, or a retry — updates the
 * notification that is already on screen instead of stacking a second copy.
 */
export const REMINDER_TAG = "kairos-daily-reminder";

/** The same artwork the web app manifest uses. */
export const REMINDER_ICON = "/kairos-logo/icon-192.png";
/** Android draws the badge as a monochrome silhouette in the status bar. */
export const REMINDER_BADGE = "/kairos-logo/kairos-white-512.png";

/**
 * How long a push service may keep a notification it could not deliver straight
 * away. An hour keeps a stale "check your tasks" from landing in the afternoon,
 * where it would read as noise rather than a reminder.
 */
export const REMINDER_TTL_SECONDS = 60 * 60;

/**
 * Delivery topic. A push service keeps at most one pending message per topic, so
 * a queued duplicate replaces the one before it (RFC 8030 §5.4).
 */
export const REMINDER_TOPIC = "kairos-daily";

/** Devices are contacted in small batches, out of courtesy to the push services. */
export const REMINDER_CONCURRENCY = 8;

/** The hour a new account starts with — 01:00 in its own timezone. */
export const DEFAULT_REMINDER_HOUR = 1;

/**
 * How much slack the broadcast gives a chosen hour.
 *
 * The reminder is sent by a scheduler that may run late, or skip an hour
 * entirely (Vercel documents cron delivery as best effort). An account is
 * therefore served when its local hour *is* the chosen one **or** up to this many
 * hours later — and because a day is only ever claimed once, the later run is a
 * retry, never a second reminder.
 */
export const REMINDER_CATCH_UP_HOURS = 2;

/** Every hour an account may choose. */
export function reminderHourOptions(): number[] {
  return Array.from({ length: 24 }, (_, hour) => hour);
}

/** True when `value` is a usable hour of the day. */
export function isValidReminderHour(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 23;
}

/**
 * Should this account be reminded at this local hour?
 *
 * `localHour` comes from the account's own timezone. Hours before the chosen one
 * are not due yet (so an early run never delivers early), and the window closes
 * after `REMINDER_CATCH_UP_HOURS` so a scheduler that missed the hour can still
 * catch up that day.
 */
export function isReminderHourDue(localHour: number, reminderHour: number): boolean {
  if (!isValidReminderHour(localHour) || !isValidReminderHour(reminderHour)) return false;
  const elapsed = localHour - reminderHour;
  return elapsed >= 0 && elapsed <= REMINDER_CATCH_UP_HOURS;
}

/**
 * A chosen hour, written the way the panel writes it: "1:00 AM", "8:00 PM".
 *
 * Formatted from a fixed date in UTC so the label is stable everywhere — the hour
 * is a number the account chose, not an instant to be converted.
 */
export function formatReminderHour(hour: number): string {
  if (!isValidReminderHour(hour)) return "—";
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "UTC",
  }).format(new Date(Date.UTC(2000, 0, 1, hour)));
}

/** What the service worker receives. */
export type ReminderPayload = {
  title: string;
  body: string;
  url: string;
  tag: string;
};

/** The exact JSON payload for the daily reminder. */
export function reminderPayload(): ReminderPayload {
  return {
    title: REMINDER_TITLE,
    body: REMINDER_BODY,
    url: REMINDER_URL,
    tag: REMINDER_TAG,
  };
}

/* -------------------------------------------------------------------------- */
/* Validity                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * A push endpoint is an HTTPS URL handed out by a push service. Only the
 * `https:` scheme is accepted: `http:` endpoints do not exist in practice, and
 * allowing them would let a tampered client point the sender at a plain-HTTP
 * host of its choosing.
 */
export function isValidPushEndpoint(value: unknown): value is string {
  if (typeof value !== "string") return false;
  if (value.length === 0 || value.length > 2048) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname.length > 0;
  } catch {
    return false;
  }
}

const BASE64_PATTERN = /^[A-Za-z0-9_\-+/]+=*$/;

/**
 * The two values the browser issues when it subscribes.
 *
 * Checked by shape rather than by exact length or by decoding: this has to stay
 * usable in the browser (`atob` is not a decoding contract worth relying on), and
 * encoders differ on padding. A key that is genuinely malformed is rejected by
 * the push service at delivery time, which is the check that matters.
 */
export function isValidSubscriptionKey(
  value: unknown,
  kind: "p256dh" | "auth",
): value is string {
  if (typeof value !== "string" || !BASE64_PATTERN.test(value)) return false;
  const length = value.replace(/=+$/, "").length;
  return kind === "p256dh" ? length >= 40 && length <= 200 : length >= 8 && length <= 100;
}

/**
 * A VAPID key pair. `bunx web-push generate-vapid-keys` writes a 65-byte
 * uncompressed P-256 public point (87 base64url characters) and its 32-byte
 * private scalar (43), so the shape is fixed. Checking it turns a truncated
 * paste into "not configured" instead of an opaque 4xx at delivery time.
 */
export function isValidVapidKey(value: unknown, kind: "public" | "private"): value is string {
  if (typeof value !== "string" || !BASE64_PATTERN.test(value)) return false;
  const length = value.replace(/=+$/, "").length;
  return kind === "public" ? length === 87 : length === 43;
}

/* -------------------------------------------------------------------------- */
/* Delivery outcomes                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Statuses that mean the subscription no longer exists: the browser profile is
 * gone, notifications were revoked, or the push service dropped it. `404` and
 * `410` are the only ones that are safe to treat as final — the row is deleted.
 */
export function isExpiredSubscriptionStatus(status: number | undefined): boolean {
  return status === 404 || status === 410;
}

/**
 * Everything else is transient: a timeout, a 429, a 5xx from the push service.
 * The device stays on the list and the reminder is left eligible for a retry.
 */
export function isRetryableDelivery(status: number | undefined): boolean {
  return !isExpiredSubscriptionStatus(status);
}

/* -------------------------------------------------------------------------- */
/* Small helpers                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Run an async task over a list with a fixed number of workers.
 *
 * Bounded rather than `Promise.all` over every device: the list has no ceiling,
 * and a push service is a third party that should not be hit with hundreds of
 * simultaneous requests from one function invocation.
 */
export async function runWithConcurrency<T>(
  items: readonly T[],
  limit: number,
  task: (item: T) => Promise<void>,
): Promise<void> {
  if (items.length === 0) return;
  let cursor = 0;
  const workers = Math.max(1, Math.min(Math.floor(limit) || 1, items.length));

  async function run(): Promise<void> {
    for (;;) {
      const current = cursor;
      cursor += 1;
      if (current >= items.length) return;
      await task(items[current]);
    }
  }

  await Promise.all(Array.from({ length: workers }, run));
}
