# Kairos

**Kairos** is an open-source, self-hosted task manager. It organises work by
category and date, breaks tasks into subtasks, and shows you where your progress
actually comes from.

The name comes from the Greek *καιρός* — the right, opportune moment to act.

Desktop layout:

```
┌───────────────┬────────────────────────────────────────────┬─────────────────┐
│ Kairos        │  All Tasks                                 │  Progress       │
│               │  [ search ]  [ category ]      Clear done  │  62%  12 of 19  │
│  Today    7   │  ┌──────────────────────────────────────┐  │  ▓▓▓▓▓▓░░░░░░   │
│  All Tasks 19 │  │ +  Add a task…   [ Add task ]        │  │                 │
│  Completed 12 │  └──────────────────────────────────────┘  │  Completed  12  │
│  Habits   2   │  YESTERDAY  1                              │  Remaining   7  │
│               │  ⠿ ☐ Send the invoice         Due Oct 2    │                 │
│  CATEGORIES   │  TODAY  5                                  │  Completed/day  │
│  ● Work   4   │  ⠿ ☐ Draft the roadmap       2/4  Work     │  ▁▃▅▂▇▅▆        │
│  ● Personal 2 │  │   ☐ Collect feedback                    │                 │
│  ● Learning 1 │  │   ☐ Outline themes                      │  [Statistics]   │
│  + Add        │  ⠿ ☐ Book the dentist         Personal     │                 │
│  Statistics   │  UNSCHEDULED  1                            │                 │
│  Settings     │  ⠿ ○ Replace the kitchen filter            │                 │
└───────────────┴────────────────────────────────────────────┴─────────────────┘
```

> **Screenshot pending.** Kairos ships without binary assets; the diagram above
> shows the desktop layout: sidebar, task workspace, and the collapsible progress
> panel.

---

## ⚠️ Security: read this first

Kairos is **multi-user and requires sign-in**. Every account gets its own private
workspace, and that separation is enforced in the query layer, not in the UI.

- The sign-in gate is **on by default and fails closed**: a deployment that is not
  configured returns an error instead of serving one shared workspace.
- **`/` and `/self-host` are public.** The marketing pages are static — no
  session, no database query, no workspace data — and are served identically to
  signed-out and signed-in visitors. Everything else is behind the gate.
- Configure Supabase Auth before sharing a URL — see
  **[docs/auth-setup.md](docs/auth-setup.md)**.
- `KAIROS_AUTH_DISABLED=true` removes the gate entirely (local development and the
  Playwright suite). Everyone who can then reach the port shares one workspace,
  so keep that on `localhost` or a network you trust.
- The Docker setup publishes the port on `127.0.0.1` by default on purpose. If
  you change `KAIROS_BIND_HOST`, you are responsible for putting authentication
  in front of it (a reverse proxy with basic auth, Tailscale, WireGuard, …).
- Exported backups contain your full task history. Treat them as private data
  and never commit them to a repository (`.gitignore` covers `backups/` and the
  export filenames).
- **Search engines.** Only the marketing pages are advertised. `robots.txt`
  disallows `/api/`, `/login`, `/auth/` and every workspace view, and the `(app)`
  layout sends `noindex` as well. A private deployment can keep the whole site
  out of search engines with `KAIROS_NO_INDEX=true`, which serves
  `Disallow: /`.

Accounts, sharing and collaboration are explicitly out of scope for v1.

---

## SEO, metadata and response hardening

- **One metadata helper.** `viewMetadata()` in `src/lib/site.ts` gives each view
  its title, description, canonical URL (`alternates.canonical`) and Open
  Graph/Twitter tags; the root layout holds the defaults, `metadataBase`,
  keywords and `WebApplication` structured data.
- **`robots.txt` and `sitemap.xml`** are generated from the route list
  (`src/app/robots.ts`, `src/app/sitemap.ts`) using `NEXT_PUBLIC_APP_URL`. The
  sitemap lists the landing page and the Docker guide (`/self-host`) and nothing
  else: every other route either needs a session or redirects to `/login`, and
  category pages are your own data. A category page that does not exist is
  `noindex`.
- **Google Search Console.** The root layout renders the ownership
  `<meta name="google-site-verification">` tag from `GOOGLE_SITE_VERIFICATION`
  (`src/lib/site.ts`), and `src/app/opengraph-image.tsx` generates the 1200×630
  card that Open Graph and Twitter share. Claiming the property and submitting
  the sitemap is step-by-step in **[docs/seo.md](docs/seo.md)**.
- **Preview deployments are not indexable.** On Vercel, a build whose
  `VERCEL_ENV` is not `production` serves `Disallow: /`, so copies of the public
  site cannot compete with it in search results.
- **A web app manifest** (`public/manifest.webmanifest`) describes the app name,
  theme colours and start URL for browsers and install prompts.
- **Security headers** (`next.config.ts`): a Content Security Policy that only
  allows the app's own origin (plus `ws:` and `eval` in development), HSTS,
  `X-Content-Type-Options`, `X-Frame-Options`/`frame-ancestors`, a
  `Referrer-Policy`, COOP and a restrictive `Permissions-Policy`. The
  `X-Powered-By` header is disabled.
- **Client payload.** Recharts is by far the biggest client dependency, so the
  charts are loaded on demand (`src/components/statistics/charts.tsx`). No task
  view ships it, which takes each of them from ~311 kB to ~208 kB of first-load
  JS; the statistics page drops from ~230 kB to ~120 kB. Barrel imports are
  rewritten to the modules actually used (`optimizePackageImports`).

When you measure, measure the **production build**:

```bash
bun run build && PORT=3000 bunx next start
# then run Lighthouse against http://localhost:3000/today
```

`next dev` ships unminified bundles, source maps and the devtools overlay, so its
scores (Total Blocking Time especially) are not representative.

---

## Features

**Tasks**

- Create a task from the quick-add field with Enter or the **Add task** button,
  then edit, complete, reopen and delete it; inline title editing
- Notes: click anywhere on a task (or its notes icon) to write plain-text notes
- One optional **category**; create new categories inline from the sidebar, the
  quick-add field or the details panel
- *Planned date* (when you intend to work on it) and *due date* (the deadline).
  New tasks are planned for the **day they are created**, so nothing ends up in
  an undated pile — the field is pre-filled and can be changed before or after
  creating the task.
- Subtasks with one visible nesting level, completion progress such as `2/4`
- Manual ordering, drag and drop (including nesting), and keyboard-accessible
  alternatives for every drag action
- Delete with an **Undo** action

**Views**

The sidebar holds four views, then one entry per category:

- **Today** — what you planned for today. Late work is deliberately *not* piled
  up here: it stays in All Tasks under the day that made it late, and in the
  progress panel's counters. Today is a plan for the day, not a backlog.
- **All Tasks** — every task grouped by day, newest day first, back through today
  and the earlier days (*Yesterday* and before), then *Unscheduled*. The
  **Completed** group at the end previews only the 10 most recent completions.
- **Completed** — the whole history, newest first, **paged** 20 per page
- **Habits** — the repeating work, with its month grid and 30-day trend
- **Category views** — overdue / today / future days / unscheduled for one category

**Habits**

- A habit is a rule — which weekdays it is due, and from which day — and every
  due day generates a task in Today. Ticking that task off is what "the habit was
  done" means.
- A missed day is simply missing, never a backlog: unfinished instances from
  earlier days are dropped, while completed ones are history and are kept.
- Month grid with per-day status, a streak and a 30-day trend, plus pause/resume.
- Habit instances never reach All Tasks, Completed or the category counters —
  they are not a queue to clear.

**Reminders**

- One optional **daily Web Push** reminder at an hour you choose, read in your
  account's timezone, enabled per device in Settings and switched off again with
  one tap. No per-task pings, no email, and nothing is sent until a device opts
  in (see **[docs/notifications.md](docs/notifications.md)**).

**Finding things**

- One filter box in the top bar narrows whatever view is open — it matches titles
  and notes, case-insensitively, and every word must match
- A category filter in All Tasks (with *Uncategorized* as a real option)
- Clear completed tasks (with confirmation), scoped to the view you are in

**Statistics**

- One condensed analytics page: current-state tiles, a completion donut with a
  separate subtask bar, and daily completion history for the last 7, 30 or 90
  days — or any custom range you pick (up to a year, charted per week above 90
  days)
- Category donut plus a per-category table (done/total, progress, still open)
- Current status and historical activity are always labelled and shown separately

**Settings**

- Nickname, avatar (the later ones unlock with lifetime completions) and password
- Light, dark and system themes; a four-step text size; timezone; first day of
  the week
- One daily reminder, at the hour you choose, per device
- Categories: create, rename, recolour, change the icon, reorder and delete —
  deleting one moves its tasks to Uncategorized rather than deleting them
- **Header tools** (off by default): a JSON export/import menu in the top bar for
  the task list alone. Export downloads `kairos-tasks-YYYY-MM-DD.json`; import
  **adds** those tasks (categories matched by name, unknown ones created) and
  never deletes anything.
- Versioned JSON export and import of the whole workspace — tasks, subtasks,
  habits, categories, history and settings — plus “reset all data”

**Your data, your database**

- PostgreSQL that you control, no telemetry and no third-party analytics
- Per-account private workspaces — sign-in through Supabase, which never sees your tasks

---

## Stack

| Concern        | Choice                                                        |
| -------------- | ------------------------------------------------------------- |
| Framework      | Next.js (App Router) + TypeScript, React Server Components     |
| Styling        | Tailwind CSS + shadcn/ui, Lucide icons, Poppins (`next/font`)  |
| Data           | PostgreSQL via Prisma ORM with committed migrations            |
| Auth           | Supabase Auth (email + Google), per-user data isolation in the query layer |
| Mutations      | Server Actions with Zod validation and optimistic UI          |
| Drag and drop  | dnd-kit (pointer **and** keyboard sensors)                     |
| Charts         | Recharts                                                       |
| Reminders      | Web Push (VAPID) from one scheduled route, at most once a day per account |
| Rate limiting  | Fixed-window counters in PostgreSQL, Upstash optional          |
| Tests          | Vitest (unit) + Playwright (end-to-end)                        |
| Packaging      | Docker + Docker Compose with a persistent volume               |

Server Components read the data, Server Actions mutate it, and Client Components
handle interaction. There is no separate backend, no React Router, and no
TanStack Query — deliberately.

---

## Quick start (local development)

Requirements: **Node.js 22+** and **[Bun](https://bun.sh)** (used for install,
scripts and tests).

```bash
git clone <your-fork-url> kairos
cd kairos
cp .env.example .env          # DATABASE_URL / DIRECT_URL point at your PostgreSQL
bun install
bunx prisma migrate deploy    # create the tables
bun run dev
```

Kairos needs a **PostgreSQL** database and a **Supabase** project, locally as well
as in production. The sign-in gate is on by default and fails closed, so a missing
configuration shows an error rather than quietly opening the app. Putting the two
`NEXT_PUBLIC_SUPABASE_*` values in `.env.local` is the normal setup; to skip
sign-in entirely for local work, set `KAIROS_AUTH_DISABLED=true`.

> **Going live?** Follow **[docs/README.md](docs/README.md)** — the step-by-step
guide for Vercel + PostgreSQL + Supabase Auth, including the checks for the
failures that cost the most time.

Open <http://localhost:3000>. The workspace starts empty and stays yours: there is
no sample data, no seeded categories and nothing created behind your back — the
quick-add field above the list is the whole first screen. The JSON backup in
Settings is how a workspace is moved in and out.

### Useful scripts

| Command             | What it does                                            |
| ------------------- | ------------------------------------------------------- |
| `bun run dev`       | Development server with hot reload                      |
| `bun run build`     | Prisma client + production build                        |
| `bun run start`     | Serve the production build                              |
| `bun run typecheck` | `tsc --noEmit`                                          |
| `bun run lint`      | ESLint                                                  |
| `bun run test`      | Unit tests (Vitest)                                     |
| `bun run test:integration` | Isolation tests against a real PostgreSQL — refuses to run against a remote host |
| `bun run test:e2e`  | End-to-end tests (Playwright; builds first)             |
| `bun run db:migrate`| Create + apply a migration during development           |
| `bun run db:studio` | Prisma Studio to inspect the database                   |
| `bun run db:reset`  | Drop and recreate the local database (destructive)      |

---

## Docker

```bash
cp .env.example .env          # set the Supabase pair, or KAIROS_AUTH_DISABLED=true
docker compose up -d --build
```

Open <http://127.0.0.1:3000>. The same steps, explained in more depth —
configuration, health checks, updates and what to do before exposing the port —
are served by the app itself at **`/self-host`**.

What the container does and how it is configured:

- The database is a **PostgreSQL service beside the app** (the `db` service in
  `compose.yaml`), kept on the `kairos-db` volume — never inside the image.
- `prisma migrate deploy` runs automatically on start (see
  `docker/entrypoint.sh`), so upgrading is a rebuild + restart.
- The published port is bound to **`127.0.0.1`** by default
  (`KAIROS_BIND_HOST` / `KAIROS_PORT` in `.env`).
- A `HEALTHCHECK` polls `/api/health`, which also verifies the database.
- **Sign-in is on by default and fails closed.** The `NEXT_PUBLIC_*` values are
  inlined by `next build`, so Compose passes them from `.env` as **build
  arguments** — change them and run `docker compose up -d --build`. A plain
  `docker compose up -d` reuses the existing image and silently keeps the old
  values. With none set, every route but the static marketing pages answers 500
  and the health check stays 503; set `KAIROS_AUTH_DISABLED=true` to run without
  sign-in (keep the port on `127.0.0.1` if you do — everyone then shares one
  workspace).
- **One instance.** The app is not designed to be scaled horizontally.
- The container runs as the unprivileged `node` user.

To confirm a stack is wired up correctly:

```bash
docker compose ps                       # db healthy, kairos "Up ... (healthy)"
curl -s localhost:3000/api/health       # {"ok":true,"database":"ok"}
docker compose logs kairos              # migrations + any config warning
curl -sI localhost:3000/login | grep -io "connect-src[^;]*"   # CSP: the Supabase origin
```

Stop, upgrade, and clean up:

```bash
docker compose down                 # stop (data stays on the volume)
docker compose up -d --build        # rebuild and restart (applies migrations)
docker compose logs -f kairos       # follow logs
docker compose down -v              # ⚠️ also deletes the volume and all data
```

---

## Backup and restore

Task data lives in PostgreSQL. The application also exports an official,
versioned JSON format.

### JSON export / import (recommended)

1. Open **Settings → Backup & data → Export JSON**. A dialog asks what to
   include: **everything**, **only open tasks**, or **one category** (with its
   subtasks and habits), and whether to include the task history. The browser
   downloads `kairos-backup-YYYY-MM-DD.json` (partial files add a suffix such as
   `-open` or `-work`).
2. To restore, choose **Import JSON**, pick the file, and review the summary that
   appears (contents, counts, timezone, and any warnings). **Importing never
   deletes anything:** it adds the rows the file holds, updates the ones it
   already knows by id, and leaves the rest of the workspace alone — so importing
   a category into a busy workspace is safe, and re-importing the same file
   changes nothing. A file is rejected outright if it is invalid — unsupported
   versions, broken references, cycles or nesting deeper than one level all fail
   before anything is written.

Exported files are private user data: keep them out of repositories (`.gitignore`
already excludes `backups/`, `*.kairos.json`, `kairos-backup-*.json` and
`kairos-tasks-*.json`).

> **Older backup files.** The format is versioned (currently **v4**, which added
> an optional `scope` describing a partial export; v3 added habits and the habit
> link on a generated task). Files written by v1–v3 are still accepted: labels
> and priorities no longer exist, so those fields are ignored and the import
> summary says so. Every reference between tasks, subtasks, categories and
> habits is checked before anything is written.

### Tasks-only transfer

For moving a task list rather than a whole workspace, switch on **Settings →
Header tools** and the top bar gains an export/import menu. Its file
(`kairos-tasks-YYYY-MM-DD.json`) holds tasks and subtasks only — no ids, no
settings, no history — and categories travel by **name**. Importing adds what is
in the file and never deletes anything, so it is safe to run twice or into a
workspace that already has the same tasks.

### Database-level snapshot

```bash
# the DIRECT connection, not the pooled one
pg_dump "$DIRECT_URL" > "kairos-$(date +%F).sql"
```

Restore with `psql "$DIRECT_URL" < kairos-2026-01-01.sql`.

---

## Configuration

All configuration is environment based; see `.env.example`.

| Variable              | Default                  | Purpose                                                     |
| --------------------- | ------------------------ | ----------------------------------------------------------- |
| `DATABASE_URL`        | — (required)             | PostgreSQL connection the app uses. Use the **pooled** host in production. |
| `DIRECT_URL`          | — (required for migrations) | direct connection, used by the Prisma CLI only             |
| `NEXT_PUBLIC_SUPABASE_URL` | — (required)        | Supabase project URL — enables the sign-in gate             |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | — (required)  | the public anon / publishable key                           |
| `KAIROS_AUTH_DISABLED` | `false`                 | `true` removes the sign-in gate — **local development only** |
| `KAIROS_ALLOWED_EMAILS` | unset                  | allow-list for a *private* deployment; leave unset on a public app |
| `PORT`                | `3000`                   | Port the server listens on.                                  |
| `KAIROS_BIND_HOST`    | `127.0.0.1`              | Compose: the host interface the port is published on.        |
| `KAIROS_PORT`         | `3000`                   | Compose: the host port.                                      |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000`  | Absolute origin used for canonical links, `sitemap.xml` and social metadata. Set it before serving a real domain. |
| `KAIROS_NO_INDEX`     | `false`                  | `true` sends `Disallow: /` to every crawler (private deployment). |
| `GOOGLE_SITE_VERIFICATION` | the built-in Kairos token | Search Console ownership token rendered as `<meta name="google-site-verification">`; set it only to claim a different property ([docs/seo.md](docs/seo.md)). |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | unset | Web Push key pair and the contact the push services get. Unset = Settings says notifications are not configured for this deployment. |
| `KAIROS_CRON_SECRET` (or `CRON_SECRET` on Vercel) | unset | Shared secret the reminder broadcast requires; with none set, every call is refused. |
| `KAIROS_RATE_LIMIT_DISABLED` | `false` | `true` turns the limiter off — for test suites and scripts only, and ignored on a hosted deployment. |
| `KAIROS_RATE_LIMIT_STORE` | auto | `upstash`, `postgres` or `memory`. Unset lets the app decide: Upstash when configured, PostgreSQL on a hosted deployment, memory locally ([docs/rate-limiting.md](docs/rate-limiting.md)). |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | unset | Optional shared store for the rate-limit counters. |

Theme, text size, timezone, week start, reminder hour and the header-tools switch
are stored **in the database** (Settings), so they apply to date grouping on the
server as well as to what you see, and they follow you into another browser. The
theme is applied instantly; a browser that has never chosen one follows the
operating system. `light`, `dark` and `system` are available from **Settings →
Profile**, from the sidebar, and from the site header. The text size is a root
font size, so it scales the whole interface — text, rows and controls together.

### Keyboard shortcuts

| Keys | Action |
| --- | --- |
| `Shift` + `T` | Today |
| `Shift` + `A` | All Tasks |
| `Shift` + `C` | Completed |
| `Shift` + `H` | Habits |
| `Shift` + `S` | Statistics |
| `Shift` + `I` | Settings |
| `/` | Focus the filter box |
| `n` | New task |
| `t` | Switch between light and dark |
| `?` | Show this list |

Navigation is one modifier plus one key, so it never waits for a second press.
Shortcuts are ignored while you are typing in a field or while a dialog is open;
`Esc` leaves the field. Everything that moves honours `prefers-reduced-motion`.

### Sessions

The session lives in a cookie that the middleware refreshes on every request, so
you stay signed in between visits. A visitor with a live session is sent straight
to `/today` — from the landing page as well — instead of being shown the sign-in
page again. **Sign out** is in Settings → Profile (and the sidebar foot).

---

## How Kairos works

A few decisions worth knowing before reading the code:

- **Date-only values.** `scheduledDate` and `dueDate` are stored as UTC midnight
  so they never shift with a timezone. Real instants (`createdAt`, `completedAt`,
  event timestamps) are stored as UTC and formatted for display. “Today” is
  computed with the timezone from Settings.
- **Overdue** means: unfinished **and** (due date has passed **or** planned date
  has passed). Each view shows such a task exactly once.
- **Subtasks** are rows in the same `task` table linked by `parentId`. One level
  only; cycles, self-parenting and deeper nesting are rejected on the server.
  Subtasks inherit their parent's category; completing a parent completes its
  unfinished subtasks in one transaction; reopening a parent leaves subtasks
  alone; completing every subtask does not complete the parent; deleting a parent
  deletes its subtasks.
- **Nesting by drag.** Dragging a task to the right onto another task makes it a
  subtask (the target row is highlighted and the drag preview says
  “→ make subtask”); dragging a subtask to the left, or dropping it in a day's
  empty space, pulls it back out. The details panel and each row's menu offer the
  same actions without a mouse drag.
- **Ordering.** Positions are integers. When something moves, the server rebuilds
  the order for the whole sibling set inside a transaction, so the result is
  always consistent (`src/lib/ordering.ts`).
- **App chrome.** The sidebar and the progress panel are sticky and never scroll
  with the task list; the mobile header stays visible too.
- **History.** Completed and reopened actions are recorded as `TaskEvent` rows.
  The activity charts read events, so reopening a task today does not erase the
  day it was finished. Each task counts at most once per day, no matter how often
  its checkbox is toggled.
- **Habits are generated rows, not a flag on a task.** Every due day creates an
  ordinary task carrying `habitId` and `habitDate`; ticking it off is what “the
  habit was done” means. Streak, month grid and trend are derived from that
  history, so pausing or deleting a habit never rewrites the past. The instances
  are created idempotently on render (`ensureHabitInstances`, `ON CONFLICT DO
  NOTHING`) and are hidden from every view except Today and Habits.
- **Serverless-friendly data access.** Workspace routes are dynamic, so every
  render reads settings, categories, counters and habit instances. In-app links
  are therefore **not prefetched** (`prefetch={false}`): a prefetch is a full
  render against the database, and a page that prefetched five routes at once
  exhausted Prisma's connection pool on Vercel. Hosted deployments also cap the
  client at two connections per instance with a 20 s wait (`src/server/db.ts`).
- **Categories vs. deletion.** Deleting a category moves its tasks to
  Uncategorized (`onDelete: SetNull`), so tasks are never deleted as a side
  effect.
- **Optimistic updates.** Changes appear immediately through React's
  `useOptimistic`; if a save fails, React discards the change and the UI
  explains what happened and that the list was restored. New tasks get their id
  from the client, so anything you do to a freshly typed row (ticking a subtask,
  opening the details panel) still targets a real record.

### Project structure

```
src/
├── app/
│   ├── (marketing)/           # public site: / and /self-host (the Docker guide)│   ├── (auth)/                # /login, /register
│   ├── auth/callback/         # where Supabase returns after sign-in
│   ├── (app)/                 # signed-in shell (layout = sidebar + top bar)
│   │   ├── today/ tasks/ completed/ habits/
│   │   ├── categories/[slug]/ statistics/ settings/
│   │   └── loading.tsx error.tsx
│   ├── api/
│   │   ├── backup/            # full-workspace JSON download
│   │   ├── tasks/export/      # tasks-only transfer file
│   │   ├── cron/daily-reminder/
│   │   └── health/            # container health check
│   └── globals.css robots.ts sitemap.ts opengraph-image.tsx
├── components/
│   ├── tasks/                 # workspace, rows, details, pagination, optimistic state
│   ├── habits/                # month grid, trend, habit dialog
│   ├── layout/                # sidebar, top bar, progress panel, transfer menu
│   ├── marketing/ settings/ statistics/ categories/
│   └── ui/                    # shadcn/ui primitives
├── lib/                       # pure, testable rules
│   ├── dates.ts               # date-only handling and timezone “today”
│   ├── views.ts               # grouping rules for every view
│   ├── ordering.ts            # position/ordering maths
│   ├── task-rules.ts          # subtask constraints
│   ├── habits.ts avatars.ts push.ts shortcuts.ts
│   ├── filters.ts stats.ts validation.ts backup.ts task-transfer.ts
│   └── rate-limit.ts auth-rules.ts site.ts
├── server/
│   ├── services/              # database + business rules (server only)
│   ├── actions/               # Server Actions (validate → service → revalidate)
│   └── db.ts auth.ts rate-limit.ts
├── middleware.ts              # session refresh + the access gate
└── types/
prisma/
├── schema.prisma
└── migrations/                # committed, applied on start
tests/
├── unit/                      # views, subtasks, ordering, backups, habits, stats, …
├── integration/               # per-account isolation against a real PostgreSQL
└── e2e/                       # Playwright: workflow, drag and drop, backups
```

---

## Documentation

| Document | What it covers |
| --- | --- |
| [docs/README.md](docs/README.md) | the step-by-step deployment walkthrough |
| [docs/deployment.md](docs/deployment.md) | the deployment runbook in depth |
| [docs/auth-setup.md](docs/auth-setup.md), [docs/supabase-auth.md](docs/supabase-auth.md) | sign-in configuration and the session model |
| [docs/multi-user.md](docs/multi-user.md) | how per-account isolation is enforced |
| [docs/notifications.md](docs/notifications.md) | the daily reminder and Web Push |
| [docs/rate-limiting.md](docs/rate-limiting.md) | the limits, the buckets and where the counters live |
| [docs/seo.md](docs/seo.md) | metadata, the sitemap and Search Console |
| [docs/troubleshooting.md](docs/troubleshooting.md) | the failures worth knowing about |

---

## Testing

```bash
bun run typecheck        # tsc
bun run lint             # eslint
bun run test             # 311 unit tests across 23 files
bun run test:integration # per-account isolation, against a local PostgreSQL
bun run test:e2e         # builds, then drives the app against a throw-away database
```

The unit suite covers the pure rules in `src/lib` — date grouping and every view,
subtask rules, ordering, filters, statistics, habits, avatars, push scheduling,
shortcut matching, import validation (backup v1–v3 and the tasks-only format),
the rate-limit policy and the access matrix. The integration suite needs a local
PostgreSQL and refuses to run against a remote host. The Playwright suite drives
the real application and covers:

- the first-run experience: a fresh workspace is the quick-add field and nothing
  else — no sample data, no empty-state block — then a task created with Enter
  survives a reload, and All Tasks groups work under *Today*, *Yesterday* and
  *Unscheduled*
- notes saved from the details panel, a subtask added and ticked without
  completing the parent, then the parent completed, reopened, deleted and undone
- quick category creation from the sidebar and inline from the quick-add picker
- drag and drop: reordering persists, dropping into a date group changes the
  planned date, dragging a task right nests it, and a subtask can be pulled back
  out
- backup: the spec builds its own workspace (a category, a task with notes and a
  subtask, a completed task and a habit), exports, wipes, imports, and checks
  every row came back; an invalid file is rejected without touching the data
- statistics, settings, the export endpoint and the health check

---

## Limitations (v1)

- Accounts are individual — there is no sharing, no teams, no collaboration.
- One instance with one PostgreSQL database. Horizontal scaling is not supported;
  the app is built for a personal workspace, and serverless deployments keep a
  small connection pool per instance.
- One level of subtasks, and one category per task. Labels and priorities were
  removed from the product; a task is grouped by its category and dates.
- Repeating work exists only as a **habit** — a weekday rule with one instance per
  day. There are no arbitrary repeat rules and no calendar sync.
- One daily reminder per account, and no per-task notifications, email digests or
  webhooks.
- Subtasks have a title and a status only (no notes, dates or categories).
- All top-level tasks for the current page are loaded and grouped in the browser;
  this is comfortable for personal volumes and keeps the UI responsive.
- Undo is available for deletions and for failed saves, not for edits.

## License

[MIT](LICENSE) © Kairos contributors.
