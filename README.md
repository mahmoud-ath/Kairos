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
│  All Tasks 19 │  │ +  Add a task and press Enter…       │  │                 │
│  Completed 12 │  └──────────────────────────────────────┘  │  Completed  12  │
│               │  YESTERDAY  1                              │  Remaining   7  │
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
- **`/` is public.** The landing page is static marketing content — no session, no
  database query, no workspace data — served identically to signed-out and
  signed-in visitors. Everything else is behind the gate.
- Configure Supabase Auth before sharing a URL — see
  **[docs/auth-setup.md](docs/auth-setup.md)**.
- `KAIROS_AUTH_DISABLED=true` removes the gate entirely (local development and the
  Playwright suite). Everyone who can then reach the port shares one workspace,
  so keep that on `localhost` or a network you trust.
- The Docker setup publishes the port on `127.0.0.1` by default on purpose. If
  you change `KAIROS_BIND_HOST`, you are responsible for putting authentication
  in front of it (a reverse proxy with basic auth, Tailscale, WireGuard, …).
- Exported backups contain your full task history. Treat them as private data
  and never commit them to a repository.
- **Search engines.** The views are indexable by default (`robots.txt` allows
  crawling but never `/api/`), so anyone can find the app if it is reachable from
  the internet. A private deployment can opt out completely with
  `KAIROS_NO_INDEX=true`, which serves `Disallow: /`.

Accounts, sharing and collaboration are explicitly out of scope for v1.

---

## SEO, metadata and response hardening

- **One metadata helper.** `viewMetadata()` in `src/lib/site.ts` gives each view
  its title, description, canonical URL (`alternates.canonical`) and Open
  Graph/Twitter tags; the root layout holds the defaults, `metadataBase`,
  keywords and `WebApplication` structured data.
- **`robots.txt` and `sitemap.xml`** are generated from the route list
  (`src/app/robots.ts`, `src/app/sitemap.ts`) using `NEXT_PUBLIC_APP_URL`. Only
  the shared views are listed — category pages are your own data and are never
  advertised. A category page that does not exist is `noindex`.
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

- Create, edit, complete, reopen and delete tasks; inline title editing
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

Three views, always in the sidebar:

- **Today** — what you planned for today, plus overdue work in its own section
- **All Tasks** — every task grouped by day, from the earliest past day
  (*Yesterday* and earlier) through today and the future, then *Unscheduled*
- **Completed** — finished tasks, newest first
- **Category views** — overdue / today / future days / unscheduled for one category

**Finding things**

- Search across titles and notes
- Clear completed tasks (with confirmation)

**Statistics**

- One condensed analytics page: current-state tiles, a completion donut with a
  separate subtask bar, and daily completion history for the last 7 or 30 days
- Category donut plus a per-category table (done/total, progress, still open)
- Current status and historical activity are always labelled and shown separately

**Settings**

- Light, dark and system themes; timezone; first day of the week
- Manage categories
- Versioned JSON export and import, plus “reset all data”

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

Open <http://localhost:3000>. The workspace starts empty: use the quick-add
field, or press **Load example tasks** on the first-run screen. Demo data is
only ever created when you ask for it, and only into an empty database. The
set is three categories and eight tasks: two of them have subtasks, one has
no dates at all, one is already finished, and one is late on purpose so the
*Overdue* section is visible from the first screen.

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

Open <http://127.0.0.1:3000>.

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
  values. With none set, every route but `/` answers 500 and the health check
  stays 503; set `KAIROS_AUTH_DISABLED=true` to run without sign-in (keep the
  port on `127.0.0.1` if you do — everyone then shares one workspace).
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

1. Open **Settings → Backup & data → Export JSON**. The browser downloads
   `kairos-backup-YYYY-MM-DD.json` containing tasks, subtasks, categories,
   history events and settings.
2. To restore, choose **Import JSON**, pick the file, and review the summary that
   appears (counts, timezone, and any warnings). Importing **replaces** the
   current data, in a single transaction, and is rejected outright if the file is
   invalid — unsupported versions, broken references, cycles or nesting deeper
   than one level all fail before anything is written.

Exported files are private user data: keep them out of repositories (`.gitignore`
already excludes `*.kairos.json` and `backups/`).

> **Upgrading from an earlier build.** The bundled migration
> `20261005090000_drop_priority_and_labels` removes the label tables and the
> `priority` column (categories are now the only grouping, and priorities are
> gone). Export a backup first if you want to keep that data. Backups made by the
> earlier version are still importable: their labels and priorities are ignored,
> and the import summary tells you so.

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

Theme, timezone and the first day of the week are stored **in the database**
(Settings) so they apply to date grouping on the server, not just in the UI. The
theme is applied instantly and saved to the account, so it follows you into
another browser; a browser that has never chosen one follows the operating
system. `light`, `dark` and `system` are available from **Settings → Profile**,
from the sidebar, and from the site header.

### Keyboard shortcuts

| Keys | Action |
| --- | --- |
| `g` `t` | Today |
| `g` `a` | All Tasks |
| `g` `c` | Completed |
| `g` `s` | Statistics |
| `g` `,` | Settings |
| `/` | Focus the task search |
| `n` | New task |
| `t` | Switch between light and dark |
| `?` | Show this list |

A sequence waits about a second for its second key. Shortcuts are ignored while
you are typing in a field or while a dialog is open; `Esc` leaves the field.
Everything that moves honours `prefers-reduced-motion`.

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
│   ├── (app)/                 # authenticated-free app shell routes
│   │   ├── today/ tasks/ completed/
│   │   ├── categories/[id]/ statistics/ settings/
│   │   └── layout.tsx         # sidebar + shell, loaded once
│   ├── api/backup/            # JSON export download
│   ├── api/health/            # container health check
│   └── globals.css            # design tokens (light + dark)
├── components/
│   ├── tasks/                 # workspace, rows, details panel, optimistic state
│   ├── layout/                # sidebar, progress panel, mobile drawer
│   ├── categories/ statistics/ settings/
│   └── ui/                    # shadcn/ui primitives
├── lib/                       # pure, testable rules
│   ├── dates.ts               # date-only handling and timezone "today"
│   ├── views.ts               # grouping rules for every view
│   ├── ordering.ts            # position/ordering maths
│   ├── task-rules.ts          # subtask constraints
│   ├── filters.ts stats.ts validation.ts backup.ts
├── server/
│   ├── services/              # database + business rules (server only)
│   └── actions/               # Server Actions (validate → service → revalidate)
└── types/
prisma/
├── schema.prisma
└── migrations/                # committed, applied on start
tests/
├── unit/                      # grouping, subtask rules, ordering, backups, stats
└── e2e/                       # Playwright: workflow, drag and drop, backups
```

---

## Testing

```bash
bun run typecheck   # tsc
bun run lint        # eslint
bun test            # 67 unit tests: date grouping, subtask rules, ordering,
                    # backup validation (incl. v1 files), statistics, dates
bun run test:e2e    # builds, then runs Playwright against a throw-away database
```

Unit tests cover the pure rules in `src/lib`. The Playwright suite drives the
real application and covers:

- the main workflow: Enter creates a task, it survives a reload, notes are saved
  by clicking a task, subtasks can be added and ticked without completing the
  parent, the parent can be completed and reopened, then deleted and undone
- the first-run experience: reset all data, load the example tasks, and the All
  Tasks view showing *Yesterday*, *Today* and *Unscheduled* groups
- quick category creation from the sidebar
- drag and drop: reordering persists, dropping into a date group changes the
  planned date, dragging a task right nests it, and a subtask can be pulled back
  out
- backup: export → wipe → import round-trips tasks, subtasks, categories and
  counters; an invalid file is rejected without touching the data
- statistics, settings, the export endpoint and the health check

---

## Limitations (v1)

- Accounts are individual — there is no sharing, no teams, no collaboration.
- One instance with one PostgreSQL database. Horizontal scaling is not supported.
- One level of subtasks, and one category per task. Labels and priorities were
  removed from the product; a task is grouped by its category and dates.
- No recurring tasks, reminders, notifications or calendar sync.
- Subtasks have a title and a status only (no notes, dates or categories).
- All top-level tasks are loaded for the current page and grouped in the browser;
  this is comfortable for personal volumes and keeps the UI responsive.
- Undo is available for deletions and for failed saves, not for edits.

## License

[MIT](LICENSE) © Kairos contributors.
