"use client";

import { Bell, BellOff, BellRing, Loader2, Send } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  DEFAULT_REMINDER_HOUR,
  REMINDER_BODY,
  REMINDER_TITLE,
  formatReminderHour,
  isReminderHourDue,
  reminderHourOptions,
} from "@/lib/push";
import { updateSettingsAction } from "@/server/actions/settings";
import {
  sendTestPushAction,
  subscribeToPushAction,
  unsubscribeFromPushAction,
} from "@/server/actions/push";

/**
 * The daily reminder, as this device sees it.
 *
 * The state shown is the browser's **real** state, read from
 * `pushManager.getSubscription()` rather than remembered in a variable: the
 * permission, the subscription and the row in the database can each go out of
 * step with the others, and the only honest thing to show is what this browser
 * actually holds.
 *
 * Permission is requested on a click and never on page load — a page that asks
 * for notifications the moment it opens is how an app gets permanently blocked
 * by someone who never got to decide.
 */

type DeviceState =
  | "checking"
  | "unsupported"
  | "unconfigured"
  | "blocked"
  | "off"
  | "on";

/** Does this browser have everything the feature needs? */
function supportsPush(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/**
 * Is this an iPhone or iPad?
 *
 * Web Push itself is platform-neutral — this is the one platform whose rules are
 * worth spelling out. Safari on iOS delivers push only to a Kairos installed on
 * the Home Screen; a Safari *tab* cannot receive one, whatever the iOS version.
 * Knowing the platform lets the panel say that, rather than leaving somebody
 * tapping a button that cannot work in a tab.
 */
function isAppleMobile(): boolean {
  if (typeof navigator === "undefined") return false;
  // iPadOS reports itself as a Mac, and is distinguishable only by touch points.
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

/** True when Kairos is running as an installed app rather than in a browser tab. */
function isInstalled(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches === true ||
    (window.navigator as { standalone?: boolean }).standalone === true
  );
}

/**
 * The VAPID public key arrives as base64url; `subscribe()` wants bytes.
 * Decoded by hand because `atob` needs standard base64 with padding. Returning an
 * `ArrayBuffer` (rather than a typed array) keeps this assignable to
 * `applicationServerKey` without a cast.
 */
function urlBase64ToUint8Array(base64: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalised = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(normalised);
  const buffer = new ArrayBuffer(raw.length);
  const bytes = new Uint8Array(buffer);
  for (let index = 0; index < raw.length; index += 1) {
    bytes[index] = raw.charCodeAt(index);
  }
  return buffer;
}

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : "Unexpected error.";
}

export function NotificationsPanel({
  publicKey,
  deviceCount,
  reminderHour,
  timeZone,
}: {
  /** Server-side VAPID public key; `null` when the deployment has none. */
  publicKey: string | null;
  /** Devices this account has already switched the reminder on for. */
  deviceCount: number;
  /** Hour of the day (0-23) the account wants to be reminded at. */
  reminderHour: number;
  /** The account's timezone (Settings → Dates), which that hour is read in. */
  timeZone: string;
}) {
  const [state, setState] = useState<DeviceState>(publicKey ? "checking" : "unconfigured");
  const [endpoint, setEndpoint] = useState<string | null>(null);
  const [busy, setBusy] = useState<"enable" | "disable" | "test" | null>(null);
  const [needsHomeScreen, setNeedsHomeScreen] = useState(false);
  const [hour, setHour] = useState(reminderHour);
  const [savingHour, setSavingHour] = useState(false);

  useEffect(() => {
    // Read after mount, never during render: the server has no idea what this
    // browser is, and guessing would cause a hydration mismatch.
    setNeedsHomeScreen(isAppleMobile() && !isInstalled());

    if (!publicKey) {
      setState("unconfigured");
      return;
    }
    if (!supportsPush()) {
      setState("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setState("blocked");
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const registration = await navigator.serviceWorker.getRegistration("/");
        const subscription = await registration?.pushManager.getSubscription();
        if (cancelled) return;
        setEndpoint(subscription?.endpoint ?? null);
        setState(subscription ? "on" : "off");
      } catch {
        // Nothing registered yet, or the browser refused to answer: both mean
        // "not enabled on this device".
        if (!cancelled) setState("off");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [publicKey]);

  async function enable() {
    if (!publicKey) return;
    setBusy("enable");
    try {
      const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });

      // Requested here — after a click — and never on load.
      const permission = await Notification.requestPermission();
      if (permission === "denied") {
        setState("blocked");
        toast.error("This browser is blocking notifications");
        return;
      }
      if (permission !== "granted") {
        setState("off");
        toast.error("Notifications were not allowed", {
          description: "Nothing was changed on this device.",
        });
        return;
      }

      const subscription = await registration.pushManager.subscribe({
        // Required by Chrome: every push must be visible to the user.
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      const json = subscription.toJSON();
      const result = await subscribeToPushAction({
        endpoint: json.endpoint ?? subscription.endpoint,
        p256dh: json.keys?.p256dh,
        auth: json.keys?.auth,
      });

      if (!result.ok) {
        // Do not leave a browser subscription behind that the server does not
        // know about: it would look enabled and never receive anything.
        await subscription.unsubscribe();
        toast.error("Couldn't switch notifications on", { description: result.error });
        return;
      }

      setEndpoint(subscription.endpoint);
      setState("on");
      toast.success("Notifications are on for this device");
    } catch (error) {
      toast.error("Couldn't switch notifications on", { description: errorMessage(error) });
    } finally {
      setBusy(null);
    }
  }

  async function disable() {
    setBusy("disable");
    try {
      const registration = await navigator.serviceWorker.getRegistration("/");
      const subscription = await registration?.pushManager.getSubscription();
      const target = subscription?.endpoint ?? endpoint;

      if (subscription) await subscription.unsubscribe();

      if (target) {
        const result = await unsubscribeFromPushAction({ endpoint: target });
        if (!result.ok) {
          // The device is already unsubscribed, so this row can never be
          // delivered to again: a push service answers 410 and the daily job
          // drops it. Say what happened rather than pretending it worked.
          toast.error("The server could not forget this device", { description: result.error });
        }
      }

      setEndpoint(null);
      setState("off");
      toast.success("Notifications are off for this device");
    } catch (error) {
      toast.error("Couldn't switch notifications off", { description: errorMessage(error) });
    } finally {
      setBusy(null);
    }
  }

  async function sendTest() {
    if (!endpoint) return;
    setBusy("test");
    try {
      const result = await sendTestPushAction({ endpoint });
      if (!result.ok) {
        toast.error("Couldn't send the test notification", { description: result.error });
        return;
      }
      toast.success("Test notification sent", {
        description: "It should appear within a few seconds.",
      });
    } finally {
      setBusy(null);
    }
  }

  async function chooseHour(next: number) {
    const previous = hour;
    setHour(next);
    setSavingHour(true);
    try {
      const result = await updateSettingsAction({ reminderHour: next });
      if (!result.ok) {
        setHour(previous);
        toast.error("Couldn't save the reminder hour", { description: result.error });
        return;
      }
      toast.success(`Reminder set for ${formatReminderHour(next)}`);
    } finally {
      setSavingHour(false);
    }
  }

  /**
   * Can the free daily schedule deliver the chosen hour?
   *
   * The Vercel Hobby cron runs once a day, around 01:00 in Casablanca. Hours that
   * window cannot reach are only delivered by an hourly scheduler, and saying so
   * is better than saving a choice that quietly never arrives.
   */
  const coveredByDailySchedule = isReminderHourDue(DEFAULT_REMINDER_HOUR, hour);

  return (
    <section
      id="notifications"
      className="flex scroll-mt-20 flex-col gap-4 rounded-lg border border-border bg-card px-4 py-4"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-sm font-semibold">Notifications</h2>
          <p className="text-xs text-muted-foreground">Daily reminder</p>
        </div>
        <span className="text-xs text-muted-foreground">
          {state === "on" ? "On for this device" : "Off for this device"}
        </span>
      </div>

      <p className="text-xs text-muted-foreground">
        Receive a daily reminder at {formatReminderHour(hour)} ({timeZone}). One reminder goes out
        to every device you switch it on for, and it never mentions a task by name.
      </p>

      <div className="flex flex-col gap-1">
        <Label htmlFor="reminder-hour" className="text-xs">
          Reminder hour
        </Label>
        <div className="flex items-center gap-2">
          <select
            id="reminder-hour"
            aria-label="Reminder hour"
            value={hour}
            disabled={savingHour}
            onChange={(event) => void chooseHour(Number(event.target.value))}
            className="h-9 rounded-md border border-border bg-background px-2 text-xs tabular-nums transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
          >
            {reminderHourOptions().map((option) => (
              <option key={option} value={option}>
                {formatReminderHour(option)}
              </option>
            ))}
          </select>
          <span className="text-[11px] text-muted-foreground">
            in {timeZone} — the timezone in Settings above
          </span>
          {savingHour ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : null}
        </div>
        {coveredByDailySchedule ? null : (
          <p className="text-[11px] text-amber-600 dark:text-amber-500">
            Saved. Your hour is delivered by Kairos&apos;s scheduler: the free daily one only
            runs once a day, around 1:00 AM, so any other hour needs the hourly scheduler — see{" "}
            <code className="text-[11px]">docs/notifications-testing.md</code>.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1 rounded-md border border-border bg-muted/40 px-3 py-2">
        <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
          What it says
        </span>
        <span className="text-xs font-medium">{REMINDER_TITLE}</span>
        <span className="text-xs text-muted-foreground">{REMINDER_BODY}</span>
        <span className="text-[11px] text-muted-foreground">Tapping it opens Today.</span>
      </div>

      {needsHomeScreen ? (
        <div className="flex flex-col gap-1 rounded-md border border-border bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground">
          <span className="text-xs font-medium text-foreground">
            On iPhone and iPad: add Kairos to your Home Screen first
          </span>
          <span>
            Safari delivers notifications to an installed app only — never to a tab. Tap the
            Share button, choose <em>Add to Home Screen</em>, open Kairos from the new icon, and
            switch the reminder on there. iOS 16.4 or newer is required.
          </span>
        </div>
      ) : null}

      {state === "unconfigured" ? (
        <p className="text-xs text-muted-foreground">
          Notifications are not configured on this deployment — the VAPID keys are missing.
          See <code className="text-[11px]">docs/deployment.md</code> to generate them.
        </p>
      ) : null}

      {state === "unsupported" ? (
        <p className="text-xs text-muted-foreground">
          This browser cannot show notifications. Kairos uses standard Web Push, which Chrome,
          Edge, Firefox and Safari all support on desktop, and Chrome supports on Android — so
          another browser on this device will work.
        </p>
      ) : null}

      {state === "blocked" ? (
        <div className="flex flex-col gap-1 text-xs text-muted-foreground">
          <p className="font-medium text-destructive">Notifications are blocked in this browser.</p>
          <p>
            <strong>Chrome or Edge:</strong> click the icon at the left of the address bar (or the
            ⋮ menu → Settings → Site settings → Notifications), set Kairos to <em>Allow</em>, then
            reload this page.
          </p>
          <p>
            <strong>Safari:</strong> Safari → Settings → Websites → Notifications, find this site
            and choose <em>Allow</em>. On macOS you may also need to allow notifications for
            Safari itself in System Settings → Notifications.
          </p>
          <p>
            <strong>Firefox:</strong> click the shield or lock icon in the address bar, clear the
            blocked permission, then reload.
          </p>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {state === "on" ? (
          <>
            <Button size="sm" variant="outline" onClick={() => void disable()} disabled={busy !== null}>
              {busy === "disable" ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <BellOff className="mr-1.5 h-3.5 w-3.5" />
              )}
              Disable notifications on this device
            </Button>
            <Button size="sm" onClick={() => void sendTest()} disabled={busy !== null}>
              {busy === "test" ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="mr-1.5 h-3.5 w-3.5" />
              )}
              Send a test notification
            </Button>
          </>
        ) : (
          <Button
            size="sm"
            onClick={() => void enable()}
            disabled={busy !== null || state === "checking" || state === "unsupported" || state === "unconfigured"}
          >
            {busy === "enable" || state === "checking" ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <BellRing className="mr-1.5 h-3.5 w-3.5" />
            )}
            {state === "checking" ? "Checking this device…" : "Enable notifications on this device"}
          </Button>
        )}
      </div>

      <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Bell className="h-3 w-3" aria-hidden="true" />
        {deviceCount === 0
          ? "No device is subscribed yet."
          : `${deviceCount} ${deviceCount === 1 ? "device is" : "devices are"} subscribed across your account.`}
        {" "}Delivery can be delayed by connectivity, battery optimisation (especially on
        Android), or browser restrictions.
      </p>
    </section>
  );
}
