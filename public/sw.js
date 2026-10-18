/* global self */

/**
 * Kairos service worker.
 *
 * Two jobs, and nothing else:
 *
 * 1. `push` — draw the daily reminder.
 * 2. `notificationclick` — bring the app back to the foreground, on `/today`.
 *
 * There is deliberately **no `fetch` handler**. A worker that intercepts
 * requests is a cache, and this app deliberately does not cache authenticated
 * pages: a Kairos document contains one account's tasks, and a cached copy
 * outliving a sign-out is exactly the bug that is hard to notice.
 *
 * The values below are copies of constants in `src/lib/push.ts`. A service worker
 * is served as a plain file and cannot import them, so they are repeated with
 * these defaults as the fallback path: the payload always carries the real ones.
 */

const DEFAULT_TITLE = "Kairos";
const DEFAULT_BODY = "Check your tasks for tomorrow.";
const DEFAULT_URL = "/today";
const TAG = "kairos-daily-reminder";
const ICON = "/kairos-logo/icon-192.png";
const BADGE = "/kairos-logo/kairos-white-512.png";

/**
 * Resolve a notification target, refusing anything that is not this origin.
 *
 * `data.url` arrives in a push payload. Today the sender is our own server, but
 * a notification is a UI surface that survives changes in who can send one — so
 * the rule is enforced here as well: an absolute URL to another site falls back
 * to `/today` instead of opening it.
 */
function safeTarget(value) {
  try {
    const url = new URL(typeof value === "string" && value ? value : DEFAULT_URL, self.location.origin);
    return url.origin === self.location.origin ? url.href : new URL(DEFAULT_URL, self.location.origin).href;
  } catch {
    return new URL(DEFAULT_URL, self.location.origin).href;
  }
}

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    // A payload that is not JSON is still a reason to remind somebody.
    payload = {};
  }

  const title = typeof payload.title === "string" && payload.title ? payload.title : DEFAULT_TITLE;
  const body = typeof payload.body === "string" && payload.body ? payload.body : DEFAULT_BODY;

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: ICON,
      badge: BADGE,
      // The tag is what keeps a duplicate delivery — two overlapping runs, or a
      // retry — from stacking a second copy of the same reminder.
      tag: typeof payload.tag === "string" && payload.tag ? payload.tag : TAG,
      renotify: false,
      data: { url: safeTarget(payload.url) },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = safeTarget(event.notification.data && event.notification.data.url);

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });

      // Prefer a Kairos tab that is already open: focusing it and navigating is
      // what makes the reminder feel like part of the app rather than a new one.
      for (const client of windows) {
        if (new URL(client.url).origin !== self.location.origin) continue;
        try {
          await client.focus();
          if (typeof client.navigate === "function") await client.navigate(target);
          return;
        } catch {
          // Focus or navigate can be refused (a window that is being torn down):
          // fall through and open a fresh one instead.
        }
      }

      if (self.clients.openWindow) await self.clients.openWindow(target);
    })(),
  );
});
