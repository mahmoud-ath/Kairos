# Testing the daily reminder — follow along

A step-by-step script for checking the notification feature works, on **free tiers
only** (Vercel Hobby + free PostgreSQL). Nothing here needs a paid plan, a paid
scheduler, or a native app.

- **Parts 1–3 take about 15 minutes** and prove the whole path — key, device,
  push service, service worker, notification.
- **Part 4 needs a night**, because it is the one thing that only happens on
  schedule.

Copy the checklist in [Part 6](#6-checklist) as you go.

---

## 0. What you need

- The repository, with `bun` installed.
- The phone (or a desktop browser) you want to be notified on.
- Your Kairos URL, once it is deployed.
- For production: the four environment variables from
  [notifications.md §3](notifications.md#3-set-the-environment-variables).

---

## 1. Local check (no deployment needed)

Everything except the scheduler runs locally, so start here.

```bash
bun install
bunx prisma migrate deploy          # creates the PushSubscription table
bun run dev                         # http://localhost:3000
```

If `.env` has no VAPID keys yet, generate a pair and add all four values
(`NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`,
`KAIROS_CRON_SECRET`) — `.env.example` explains each one:

```bash
bunx web-push generate-vapid-keys --json
```

Then, in the browser:

1. Open <http://localhost:3000/settings> and find **Notifications**.
2. It should say **Off for this device** and offer *Enable notifications on this
   device*.
3. Click it and choose **Allow**.
4. **Expected:** the panel switches to **On for this device**, a green
   confirmation appears, and the counter at the bottom says one device is
   subscribed.
5. Click **Send a test notification**.
6. **Expected:** a notification appears within a few seconds, titled **Kairos**,
   saying *Check your tasks for tomorrow.* Click it — `/today` should open (or an
   already-open Kairos tab should come to the front).

> A test send does **not** mark the day as reminded, so testing at 00:30 will not
> suppress the 01:00 reminder. Only the scheduled broadcast claims the date.

### 1a. Check the row was written

```bash
bunx prisma studio        # open the PushSubscription table
```

**Expected:** one row. Its `endpoint` is long, `lastSentDate` is `null` (nothing
has been *scheduled*-sent yet), and `userId` is your account. No other account's
row should ever be visible in the app, whatever this table contains.

### 1b. Run tonight's job by hand — twice

This is the check that proves duplicate prevention.

```bash
SECRET=$(grep '^KAIROS_CRON_SECRET=' .env | cut -d= -f2)

# 1st run: should deliver
curl -s -H "Authorization: Bearer $SECRET" \
  http://localhost:3000/api/cron/daily-reminder

# 2nd run, immediately after: should deliver nothing
curl -s -H "Authorization: Bearer $SECRET" \
  http://localhost:3000/api/cron/daily-reminder
```

**Expected:**

| Run | Response |
| --- | --- |
| first | `"candidates":1, "sent":1, "failed":0, "removed":0, "skipped":0` |
| second | `"candidates":0, "waiting":1` — one reminder per device per local day |

Also worth seeing:

```bash
# No secret: refused, and NOT a redirect. Vercel's cron never follows one.
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/api/cron/daily-reminder   # 401
curl -s -o /dev/null -w '%{http_code}\n' -H 'Authorization: Bearer wrong' \
  http://localhost:3000/api/cron/daily-reminder                                          # 401
```

### 1c. Check the hour you choose

The job only delivers in the hour each account asked for, so this is testable
without waiting for anything:

1. In Settings → Notifications, set **Reminder hour** to the hour you are in right
   now (check your phone's clock). A toast confirms it, and `"Reminder hour"`
   keeps that value after a page reload — it is stored on the account, not in the
   browser.
2. Run the job by hand. **Expected:** `"sent":1` again, because the device is in
   its chosen hour and has not been reminded for today yet.
3. Set the hour to something **two or three hours from now**, run the job again and
   then run it a second time. **Expected:** `"candidates":0`, with the device
   counted as `"waiting"` — it is never delivered before the hour you chose.
4. Set it back to the hour you are in and confirm delivery works again.

On a deployment with only Vercel's daily cron, picking an hour the daily run
cannot reach (anything outside ~00:00–02:00) is saved but not delivered until an
hourly scheduler exists — the panel says so next to the selector, and
[notifications.md §5](notifications.md#what-it-takes-to-be-delivered) explains the
free options.

### 1d. Turn it off again

Click **Disable notifications on this device** in Settings, then run the job by
hand once more. **Expected:** `"candidates":0`, because the row is gone.

---

## 2. Production setup (Vercel Hobby)

1. Generate the keys **once for production** (a fresh pair, not the local one):

   ```bash
   bunx web-push generate-vapid-keys --json
   ```

2. In Vercel → your project → **Settings → Environment Variables**, add:

   | Name | Value | Environments |
   | --- | --- | --- |
   | `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | the 87-character public key | Production (add Preview/Development if you want it there) |
   | `VAPID_PRIVATE_KEY` | the 43-character private key | Production |
   | `VAPID_SUBJECT` | `mailto:you@example.com` | Production |
   | `CRON_SECRET` | 16+ random characters | Production |

   > Use the name **`CRON_SECRET`** (not `KAIROS_CRON_SECRET`) on Vercel: Vercel
   > then attaches the `Authorization` header to its own cron calls for you, for
   > free. Kairos accepts either name, so nothing else changes.

3. Deploy the migration to production. Vercel never runs migrations. This writes a
   throwaway schema with the production URL inlined, so nothing is exported into
   your shell and the rest of the session stays pointed at local development:

   ```bash
   cat > migrate-prod.ts <<'EOF'
   const env = await Bun.file(".env.production.local").text();
   const url = /^DIRECT_URL=(.*)$/m.exec(env)![1].trim().replace(/^["']|["']$/g, "");
   const schema = await Bun.file("prisma/schema.prisma").text();
   await Bun.write("prisma/schema.tmp.prisma", schema.replace(/env\("[A-Z_]+"\)/g, `"${url}"`));
   console.log("wrote prisma/schema.tmp.prisma");
   EOF

   bun migrate-prod.ts
   bunx prisma migrate deploy --schema prisma/schema.tmp.prisma
   rm prisma/schema.tmp.prisma migrate-prod.ts
   ```

   > Do **not** use `set -a; . ./.env.production.local` for a one-off command: it
   > exports the production URLs into the shell you keep using, so every later
   > `prisma` command in that window also hits production.

   Confirm it took: the output should mention `20261015120000_push_subscriptions`.

4. **Redeploy** — a running deployment does not see new environment variables.

5. Check the fundamentals:

   ```bash
   curl -s https://your-app.vercel.app/api/health            # {"ok":true,"database":"ok"}
   curl -s -o /dev/null -w '%{http_code}\n' https://your-app.vercel.app/sw.js   # 200
   ```

6. Vercel → **Settings → Cron Jobs** should list `/api/cron/daily-reminder` with
   the schedule `0 0 * * *`. If it does not, the `vercel.json` in the repository
   root did not reach the deployment.

---

## 3. Per-device checks

Repeat Part 1's steps on each device, from the installed/deployed app.

| Device | Expected | If not |
| --- | --- | --- |
| Android — Chrome | permission prompt, then the test notification in the shade | Chrome ⋮ → Settings → Site settings → Notifications |
| Windows / macOS / Linux — Chrome, Edge, Firefox | permission prompt, then a system notification | check the OS's own notification settings for the *browser* |
| macOS 13+ — Safari | permission prompt, then a system notification | System Settings → Notifications → allow Safari |
| iPhone / iPad (iOS 16.4+) | **only after Share → Add to Home Screen**, opening Kairos from that icon, then Settings → Notifications | in a Safari tab the Enable button is intentionally unavailable; the panel explains this |
| An old/odd browser | the panel says notifications are not supported and points at another browser | nothing to fix — it is a browser limitation |

**Click behaviour to check on each device:** tapping the notification brings an
existing Kairos tab/window to the front on **`/today`**; if no Kairos window is
open, it opens one. (A notification whose target is somehow not this site falls
back to `/today` rather than opening anything else.)

---

## 4. The scheduled run (needs one night)

The reminder is scheduled for **`0 0 * * *` UTC**, which is Vercel's clock — not
yours. That decides when the *job* runs; when a reminder actually arrives is your
own hour, compared against your own timezone.

| Setup | Fires |
| --- | --- |
| Free daily schedule, hour set to 1:00 AM | 01:00–01:59 local (00:00–00:59 during Ramadan, when Morocco is UTC+0), with up to two hours of slack |
| Free hourly scheduler, any hour you like | in the hour you chose |

On the Hobby plan the job may be invoked at **any minute inside that UTC hour**,
and delivery after that is never instant. So a reminder that shows up at 01:20,
or at 02:05 after Doze let the phone wake up, is working as designed.

The morning after, check:

1. **Did it arrive?** Look at the phone's notification shade.
2. **Did the job run?** Vercel → project → **Cron Jobs** → *View Logs* on the job.
   Every run logs one line:

   ```json
   {"date":"2026-10-16","candidates":1,"sent":1,"failed":0,"removed":0,"skipped":0}
   ```

   | Field | What it tells you |
   | --- | --- |
   | `date` | the Morocco date it ran *for* — should be the day it fired |
   | `candidates` | devices still needing that day's reminder |
   | `sent` | handed to the push service |
   | `failed` | transient failure; the device is kept and the day is given back, so a later run retries |
   | `removed` | the push service said the subscription is gone (404/410); the row was deleted |
   | `skipped` | another invocation had already claimed those devices |

3. **Run it by hand if you like** (this also proves the secret works in
   production):

   ```bash
   curl -s -H "Authorization: Bearer $CRON_SECRET" \
     https://your-app.vercel.app/api/cron/daily-reminder
   ```

   You can run this several times: the first call in a Morocco day delivers, later
   ones report `"candidates":0`. That is the duplicate prevention doing its job, not
   a bug.

---

## 5. Free-tier facts (what is deliberately not used)

- **Vercel Hobby cron**: one daily schedule per job, invoked at an unspecified
  minute within the scheduled UTC hour, always UTC. Available on all plans, free.
- **No paid scheduler, no paid push service.** Web Push itself is free: the
  browser vendor's push service (FCM, Mozilla, Apple) delivers to the device.
  VAPID keys are self-generated — no account, no fee.
- **Do not add extra daily cron jobs** to get a different time: Hobby rejects
  sub-daily expressions, and extra runs would either duplicate the reminder or
  simply fail to deploy.
- **If you ever need 01:00 sharp all year**, do not buy anything: point a free
  external scheduler at the same endpoint (see
  [notifications.md §5](notifications.md#5-scheduling)) and remove the `crons`
  entry from `vercel.json` so it is not sent twice.
- **A different hour is free too**, but it needs one free *hourly* scheduler: Vercel
  Hobby can only run a cron once a day, so the hourly trigger has to live outside
  Vercel (cron-job.org and GitHub Actions are both free). Without one, the default
  01:00 reminder still works — the hour you pick is simply saved for when a
  scheduler can reach it.

---

## 6. Checklist

```
[ ] 1. Local
    [ ] `.env` has the four variables
    [ ] Settings shows "Off for this device"
    [ ] Enable → Allow → panel says "On for this device"
    [ ] Send a test notification → it arrives, titled Kairos
    [ ] Tapping it opens /today
    [ ] PushSubscription has one row, lastSentDate = null
    [ ] Job run #1 returns candidates 1 / sent 1
    [ ] Job run #2 returns candidates 0  (duplicate prevention ✓)
    [ ] Job with no secret returns 401 (not a redirect)
    [ ] Reminder hour: set to this hour → delivers; set to a later hour → waiting
    [ ] Disable → the row is gone → job returns candidates 0

[ ] 2. Production
    [ ] Four variables set in Vercel (scheduler secret named CRON_SECRET)
    [ ] Both migrations applied to the production database
    [ ] Redeployed after setting the variables
    [ ] /api/health returns ok, /sw.js returns 200
    [ ] Cron Jobs lists /api/cron/daily-reminder at 0 0 * * *

[ ] 3. Devices
    [ ] Android: enable + test notification
    [ ] Desktop: enable + test notification
    [ ] iPhone/iPad (if used): installed to Home Screen first, then enable

[ ] 4. Overnight
    [ ] Reminder arrived in the hour you chose (≈01:00 with the free daily schedule)
    [ ] Cron log shows a sensible summary
    [ ] Running the endpoint by hand returns candidates 0 for the rest of that day
```

---

## 7. If something fails

| Symptom | Where to look |
| --- | --- |
| Settings says notifications are not configured | the VAPID variables are missing, or the public key was truncated — [notifications.md §3](notifications.md#3-set-the-environment-variables) |
| The test notification never arrives | permission not granted, or the OS is blocking the *browser* |
| The nightly one never arrives, the test did | the scheduler: Vercel → Cron Jobs → View Logs. Expect 401 if `CRON_SECRET` is unset or renamed |
| 503 from the endpoint | the deployment has no valid VAPID keys |
| A device silently stops receiving | the browser subscription expired; enable it again on that device |

Fuller tables: [notifications.md §6](notifications.md#6-switch-it-on-for-a-device-any-platform).
