# Notifications (Web Push)

Kairos can send **one generic reminder a day**:

> **Kairos**  
> Check your tasks for tomorrow.

Tapping it opens `/today`. That is the whole feature.

It is deliberately narrow, because a reminder that guesses is worse than none:

- **No task-specific reminders.** The message never names a task, a project or a
  count.
- **One shared broadcast, with a per-account hour.** A single job serves
  everybody, but the hour it delivers for is a setting on each account (0–23, read
  in that account's own timezone). It defaults to **01:00**.
- **No native Android app.** This is standard Web Push: a service worker, VAPID,
  and the same PostgreSQL database.
- **No reminders by email, SMS or anything else.**

Notifications are **optional**. Leave the variables below empty and Kairos behaves
exactly as it did before — Settings simply says the deployment has no keys.

---

## 1. What it looks like from the outside

| Piece | Where it lives | What it does |
| --- | --- | --- |
| `PushSubscription` table | your database | one row per device: its endpoint and keys, plus the last date it was reminded |
| `Settings.reminderHour` | your database | the hour (0–23) this account wants, read in this account's timezone |
| `public/sw.js` | served from your origin | draws the notification, and handles the tap |
| `/api/cron/daily-reminder` | a Route Handler | the broadcast: reads the device list, matches each account's hour, sends, cleans up |
| `src/lib/push.ts` | shared constants and rules | the wording, the tag, the TTL, the hour window, what counts as expired |
| `src/server/services/push.ts` | server | registration, test sends, the claim-then-send broadcast |

Two things are worth stating plainly:

- **The endpoint and the keys are secrets.** The endpoint is a capability URL: it
  is enough to send a notification to that device. Kairos never logs it, never
  returns another account's endpoint, and never writes it into a backup file.
- **The reminder is per *device*, not per account.** A phone and a laptop are two
  rows, and each has to be switched on separately (Settings → Notifications).

---

## 2. Generate the VAPID keys (Bun)

VAPID is how the push service knows which application is sending. You need one
pair, for the whole deployment:

```bash
bunx web-push generate-vapid-keys --json
```

```json
{
  "publicKey": "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U",
  "privateKey": "UUxI4O8-Ft6hFp9LmWjWs6vXcNMXTw-4hRX0vSJvNQs"
}
```

- The **public key** is 87 characters and is public by design: it is handed to the
  browser so it can subscribe.
- The **private key** is 43 characters and is server-side only. Anyone holding it
  can send notifications to your subscribers.
- **Rotating the pair invalidates every subscription.** Devices simply have to
  switch the reminder on again, so keep the values somewhere you can find them.

Kairos checks the *shape* of both keys at startup. A truncated paste is reported
as "not configured" in Settings instead of failing later with an opaque error from
the push service.

---

## 3. Set the environment variables

Add these four (`.env.example` documents each one):

| Variable | Value | Where |
| --- | --- | --- |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | the 87-character public key | server (passed to the browser as a prop) |
| `VAPID_PRIVATE_KEY` | the 43-character private key | server only |
| `VAPID_SUBJECT` | `mailto:you@example.com` | server only |
| `KAIROS_CRON_SECRET` | 16+ random characters (`openssl rand -base64 32`) | server only |

On Vercel, add all four to **Production** (and Preview/Development if you want the
feature there too), then **redeploy** — a running deployment does not pick up new
environment variables.

> **Name the scheduler secret `CRON_SECRET` on Vercel.** Vercel only attaches the
> `Authorization` header to its own cron invocations when the variable has exactly
> that name. Kairos accepts `KAIROS_CRON_SECRET` first and `CRON_SECRET` second, so
> either works — but only `CRON_SECRET` gets the header for free.

The public key is *not* inlined at build time (the server reads it and passes it to
the panel), so rotating it does not require a rebuild — only a restart/redeploy.

---

## 4. Run the migration

```bash
bunx prisma migrate deploy
```

The `PushSubscription` table arrives in `20261015120000_push_subscriptions`. As
always with Vercel, **the platform never runs migrations for you** — see
[troubleshooting.md §4](troubleshooting.md#4-a-500-after-deploying-a-schema-change).
It is purely additive (one new table), so it is safe on live data.

---

## 5. Scheduling

`vercel.json` in the repository root already declares the job:

```json
{
  "crons": [{ "path": "/api/cron/daily-reminder", "schedule": "0 0 * * *" }]
}
```

Vercel sends a `GET` to that path with `Authorization: Bearer $CRON_SECRET`.
**Nothing else is required**: push the repository, connect the project, and the
schedule exists.

### The hour you choose

Settings → Notifications has a **Reminder hour** selector. It is per **account**,
not per device, and the hour is read on your own clock — your account's timezone
(Settings → Dates), not the server's:

| Your hour | Your timezone says | Delivered |
| --- | --- | --- |
| 01:00 | 01:00 | ✅ |
| 20:00 | 20:00 | ✅ |
| 20:00 | 19:59 | nothing yet — it never arrives before the hour you asked for |

Two properties are worth knowing, because they are what make it reliable rather
than fiddly:

- **A device is reminded at most once per local day**, and that day is claimed
  *before* the send. A morning retry cannot produce a second reminder later.
- **The chosen hour has two hours of slack.** If the scheduler is late or skips
  your hour entirely, the next run still delivers that day's reminder — the move
  is to catch up, never to send twice.

The window never wraps past midnight: an 11 PM reminder is not delivered at 00:30,
because it would be claimed against the *next* local day and could suppress that
evening's reminder.

### What it takes to be delivered

The hour is honoured by *whoever calls the endpoint*, so how often that happens
decides how much of the clock you can actually choose:

| Setup | Hours it can deliver | Cost |
| --- | --- | --- |
| Vercel's daily cron alone (the default here) | around **01:00** (and the hour either side, because of the slack) | free |
| An hourly scheduler calling the same endpoint | **any hour you pick** | free (cron-job.org, GitHub Actions) |

So the default setup is a working 01:00 reminder with no extra accounts, and any
other hour needs one free external scheduler. The panel says so, next to the
selector, when you pick an hour the daily cron cannot reach. Choosing an hour is
never harmful: it is saved, and the moment an hourly scheduler exists, it is
honoured.

Vercel **Hobby** cannot run a cron more than once a day (a sub-daily expression
fails the deployment), which is the only reason the hourly trigger lives outside
Vercel. Nothing about this needs a paid plan.

### Read this before trusting the time

Vercel cron expressions are **always UTC**, which is what decides *when the job runs* —
never when a reminder arrives, because that is the account's hour compared against
the account's own clock.

So:

- **On Vercel Hobby, a daily job is approximate**: the expression may only run once
  a day, and Vercel may invoke it at *any* point within the scheduled hour
  (`00:00:00`–`00:59:59` UTC) to spread load. Outside Ramadan that is 01:00–01:59 in
  Morocco, which sits inside the slack of the default 01:00 hour.
- **The job's own clock is UTC, and UTC cannot name a fixed local time in
  Morocco**, because Morocco is UTC+1 except during **Ramadan** (UTC+0). With the
  daily-only setup, the default 01:00 reminder therefore lands at 00:00–00:59 local
  during Ramadan — an hour early. Pick the hour you want and let an hourly
  scheduler call the endpoint if that matters, rather than editing the expression
  four times a year.
- Do **not** work around it by adding several daily jobs: Hobby allows one daily
  schedule per job, and extra runs would either duplicate the reminder or be
  rejected at deploy time. One hourly *external* scheduler is the free answer.

Because the message is generic, an hour of drift changes very little — nothing in
the text depends on the exact minute.

### If 01:00 sharp matters to you — or you want a different hour

Use an external scheduler and let it call the same endpoint — no code change, no
extra job on Vercel, no paid service:

| Option | Notes |
| --- | --- |
| [cron-job.org](https://cron-job.org) (free) | run it **hourly**, supports a timezone per job; send the `Authorization: Bearer …` header |
| GitHub Actions (free) | `schedule: cron: '0 * * * *'` (hourly — note that GitHub's schedules are also UTC, and may be delayed under load) |
| Any VPS crontab | `0 * * * * curl -fsS -H "Authorization: Bearer …" https://your-app/api/cron/daily-reminder` |

Hourly is enough: each account is served in the hour it chose, and the endpoint is
idempotent, so extra calls cost nothing but a log line.

If you point an external scheduler at it, delete the `crons` entry from
`vercel.json` so the reminder is not sent twice a day (once by each scheduler).
Running both is not harmful — the second call reports `"candidates":0` — but it is
untidy.

### Running it by hand

```bash
curl -H "Authorization: Bearer $KAIROS_CRON_SECRET" \
  https://your-app.vercel.app/api/cron/daily-reminder
```

```json
{
  "ok": true,
  "at": "2026-10-15T00:05:00.000Z",
  "reference": "Africa/Casablanca",
  "referenceDate": "2026-10-15",
  "referenceHour": 1,
  "candidates": 3,
  "waiting": 2,
  "sent": 3,
  "failed": 0,
  "removed": 1,
  "skipped": 0
}
```

| Field | Meaning |
| --- | --- |
| `at` | when the run happened |
| `reference` / `referenceDate` / `referenceHour` | the reminder's home timezone, and the date and hour *it* is at — the log's anchor, since each account has its own clock |
| `candidates` | devices this invocation claimed and tried to deliver to |
| `waiting` | devices whose chosen hour has not arrived yet, or whose reminder was already sent for their local date |
| `sent` | delivered to the push service |
| `failed` | transient failures — the device is kept, and the day is handed back so a later run can retry it |
| `removed` | the push service said the subscription is gone (404/410), so the row was deleted |
| `skipped` | another invocation claimed those devices first |

**Delivery is at most once per device per local day — never exactly once.** Each
device is claimed for its date *before* the send, so two overlapping invocations
cannot both deliver; if a send fails transiently the claim is released. Vercel
documents cron delivery as best effort: a run can be missed entirely, or repeated.
The notification also carries a stable `tag`, so a duplicate that does reach the
device replaces the visible notification instead of stacking a second one.

---

## 6. Switch it on for a device (any platform)

Kairos uses **standard Web Push**, not anything Android-specific: the same code
reaches every platform that implements the standard.

| Platform | Works? | Notes |
| --- | --- | --- |
| **Android** — Chrome, Edge, Firefox, Samsung Internet | ✅ | the most predictable platform; add to the Home Screen if you like, it is not required |
| **Windows / macOS / Linux** — Chrome, Edge, Firefox | ✅ | arrives in the system notification centre |
| **macOS 13+** — Safari | ✅ | Safari itself must be allowed to show notifications in System Settings |
| **iPhone / iPad** — Safari, **installed app only** | ⚠️ | iOS 16.4+, and Kairos must be **added to the Home Screen** first — a Safari *tab* can never receive a push, whatever the version |
| **iPhone / iPad** — iOS below 16.4 | ❌ | Web Push does not exist there |
| Old Safari, some in-app browsers (Instagram, Facebook) | ❌ | Settings says so and points at another browser |

The steps are the same everywhere:

1. Open your Kairos URL and sign in.
2. Go to **Settings → Notifications**.
3. Tap **Enable notifications on this device**, then **Allow** in the browser prompt.
   (The prompt only ever appears after that tap — Kairos never asks on page load.)
4. Tap **Send a test notification**. It should arrive within a few seconds.
5. Choose the **Reminder hour** you want (0–23, in your account's timezone). It
   defaults to 1:00 AM; see [the hour you choose](#the-hour-you-choose) for what
   different hours need.
6. Repeat on each device you want reminded. Every device is its own row, and each
   one can be switched off on its own.

**On iPhone and iPad**, do it *from the installed app*: tap **Share → Add to Home
Screen**, open Kairos from the new icon, then **Settings → Notifications → Enable**.
The panel says this on the page when it notices iOS in a tab.

### If a reminder does not arrive

| Symptom | Likely cause |
| --- | --- |
| Nothing at all, ever | the deployment has no VAPID keys — Settings says so outright |
| The test works, the nightly one does not | the scheduler never ran: check the project's Cron Jobs tab, and that `CRON_SECRET` is set so the header is attached |
| Nothing for hours, then it arrives late | normal. Delivery is not instant: Android Doze, battery optimisation and the push service's queue all add delay. The reminder expires after **one hour**, so a very stale one is dropped rather than delivered at a random moment |
| Some devices, not others | Samsung/Xiaomi/Huawei battery savers kill background delivery for apps that are not in the "never sleeping" list — allow Kairos to run in the background |
| iPhone: the Enable button is missing | Kairos is open in a Safari tab. Add it to the Home Screen and open it from that icon |
| iPhone: nothing arrives after enabling | check iOS **Settings → Notifications → Kairos**, and turn off Focus/Do Not Disturb for that moment |
| macOS Safari: nothing arrives | allow notifications for Safari itself in **System Settings → Notifications**, then for the site |
| It worked, then stopped | the subscription expired (browser data cleared, permissions revoked, app reinstalled). Kairos deletes those rows automatically on the next run; switch the reminder on again |
| Permission was blocked once | the browser will not prompt again. Chrome/Edge: click the icon at the left of the address bar → **Permissions** → **Notifications** → **Allow**. Safari: Settings → Websites → Notifications. Firefox: the lock icon → clear the blocked permission. Then reload Settings |

---

## 7. Verify it

```bash
bun run test              # unit: payload, key shapes, statuses, Morocco dates
bun run test:integration  # ownership, duplicate prevention, expired cleanup
```

The unit suite is where the *scheduling* reasoning is pinned down: it asserts that
`00:00` UTC is 01:00 in Casablanca outside Ramadan and 00:00 during it, and that
every minute of the hour the job may run in resolves to the same Morocco date.

`docs/notifications-testing.md` is the step-by-step test script to follow — it
covers the local run, production, and each platform.

**Notifications on a real phone have not been verified.** Everything up to the push
service is covered (the worker installs, the keys are validated, the row is
written, the broadcast claims and sends), but whether a notification actually
appears on a device depends on that device's permission, battery and push-service
behaviour — so it has to be tried on a device:

1. Set the variables, run the migration, redeploy.
2. Enable on the phone, send the test notification.
3. Run the endpoint by hand, then wait a night for the scheduled run.

---

## 8. Manual setup still required

- [ ] Generate a VAPID pair and set the four variables in your host (and locally).
- [ ] Deploy both migrations to production:
      `20261015120000_push_subscriptions` (the table) and
      `20261015140000_reminder_hour` (the hour setting).
- [ ] Redeploy, so the functions see the new variables.
- [ ] Name the scheduler secret `CRON_SECRET` on Vercel (or remove the `crons`
      entry from `vercel.json` and point a free hourly scheduler at the endpoint,
      if you want an hour the daily cron cannot reach).
- [ ] Enable the reminder on each device, send the test notification, and pick the
      hour you want.
