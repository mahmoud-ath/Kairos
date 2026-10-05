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
│  Upcoming 12  │  │ +  Add a task and press Enter…       │  │                 │
│  All Tasks 19 │  └──────────────────────────────────────┘  │  Completed  12  │
│  Completed 12 │  YESTERDAY  1                              │  Remaining   7  │
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

Kairos **version 1 is a personal, single-user application with no authentication
of any kind.**

- Run it on `localhost` or on a network you fully trust (a home server on a
  private LAN, a VPN-only host, an SSH tunnel).
- **Do not expose it to the public internet.** Anyone who can reach the port can
  read, change and delete every task.
- The Docker setup publishes the port on `127.0.0.1` by default on purpose. If
  you change `KAIROS_BIND_HOST`, you are responsible for putting authentication
  in front of it (a reverse proxy with basic auth, Tailscale, WireGuard, …).
- Exported backups contain your full task history. Treat them as private data
  and never commit them to a repository.

Accounts, sharing and collaboration are explicitly out of scope for v1.

---

## Features

**Tasks**

- Create, edit, complete, reopen and delete tasks; inline title editing
- Notes: click anywhere on a task (or its notes icon) to write plain-text notes
- One optional **category**; create new categories inline from the sidebar, the
  quick-add field or the details panel
- *Planned date* (when you intend to work on it) and *due date* (the deadline)
- Subtasks with one visible nesting level, completion progress such as `2/4`
- Manual ordering, drag and drop (including nesting), and keyboard-accessible
  alternatives for every drag action
- Delete with an **Undo** action

**Views**

- **Today** — what you planned for today, plus overdue work in its own section
- **Upcoming** — everything planned later, grouped by day
- **All Tasks** — every task grouped by day, from the earliest past day
  (*Yesterday* and earlier) through today and the future, then *Unscheduled*
- **Completed** — finished tasks, newest first
- **Category views** — overdue / today / upcoming / unscheduled for one category

**Finding things**

- Search across titles and notes
- Filters for category and completion status
- Clear completed tasks (with confirmation)

**Statistics**

- Current completion counts and percentage for the selected scope
- Separate subtask counts
- Daily completion activity for the last 7 or 30 days
- Category breakdown
- Current status and historical activity are always shown separately

**Settings**

- Light, dark and system themes; timezone; first day of the week
- Manage categories
- Versioned JSON export and import, plus “reset all data”

**Everything local**

- SQLite database on your own disk, no accounts, no telemetry, no external services

---

## Stack

| Concern        | Choice                                                        |
| -------------- | ------------------------------------------------------------- |
| Framework      | Next.js (App Router) + TypeScript, React Server Components     |
| Styling        | Tailwind CSS + shadcn/ui, Lucide icons                         |
| Data           | SQLite via Prisma ORM with committed migrations                |
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
cp .env.example .env          # DATABASE_URL="file:./dev.db" by default
bun install
bunx prisma migrate deploy    # create prisma/dev.db from the migrations
bun run dev
```

Open <http://localhost:3000>. The workspace starts empty: use the quick-add
field, or press **Load example tasks** on the first-run screen. Demo data is
only ever created when you ask for it, and only into an empty database.

### Useful scripts

| Command             | What it does                                            |
| ------------------- | ------------------------------------------------------- |
| `bun run dev`       | Development server with hot reload                      |
| `bun run build`     | Prisma client + production build                        |
| `bun run start`     | Serve the production build                              |
| `bun run typecheck` | `tsc --noEmit`                                          |
| `bun run lint`      | ESLint                                                  |
| `bun test`          | Unit tests (Vitest)                                     |
| `bun run test:e2e`  | End-to-end tests (Playwright; builds first)             |
| `bun run db:migrate`| Create + apply a migration during development           |
| `bun run db:studio` | Prisma Studio to inspect the database                   |
| `bun run db:reset`  | Drop and recreate the local database (destructive)      |

---

## Docker

```bash
cp .env.example .env          # optional: change the published port
docker compose up -d --build
```

Open <http://127.0.0.1:3000>.

What the container does and how it is configured:

- The SQLite database lives at **`/data/kairos.db`** on the named volume
  `kairos-data`. The image never contains a database, and `/data` is the only
  place data is written.
- `prisma migrate deploy` runs automatically on start (see
  `docker/entrypoint.sh`), so upgrading is a rebuild + restart.
- The published port is bound to **`127.0.0.1`** by default
  (`KAIROS_BIND_HOST` / `KAIROS_PORT` in `.env`).
- A `HEALTHCHECK` polls `/api/health`, which also verifies the database.
- **One instance only.** SQLite plus a shared volume means a second container
  would corrupt or lock the same file. Do not scale this service horizontally.
- The container runs as the unprivileged `node` user.

Stop, upgrade, and clean up:

```bash
docker compose down                 # stop (data stays on the volume)
docker compose up -d --build        # rebuild and restart (applies migrations)
docker compose logs -f kairos       # follow logs
docker compose down -v              # ⚠️ also deletes the volume and all data
```

---

## Backup and restore

Task data is a file on disk, so a copy of the database file is a complete
backup. The application also exports an official, versioned JSON format.

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

### Copying the SQLite file

```bash
# Docker: copy the database out of the volume
docker compose stop kairos
docker run --rm -v kairos-data:/data -v "$PWD:/backup" alpine \
  cp /data/kairos.db "/backup/kairos-$(date +%F).db"
docker compose start kairos
```

Restoring is the reverse: stop the app, put the file back at `/data/kairos.db`,
start the app. Stop the application first — SQLite is not safe to copy while it
is being written.

---

## Configuration

All configuration is environment based; see `.env.example`.

| Variable            | Default              | Purpose                                                    |
| ------------------- | -------------------- | ---------------------------------------------------------- |
| `DATABASE_URL`      | `file:./dev.db`      | SQLite location. Docker uses `file:/data/kairos.db`.        |
| `PORT`              | `3000`               | Port the server listens on.                                 |
| `KAIROS_BIND_HOST`  | `127.0.0.1`          | Compose: the host interface the port is published on.       |
| `KAIROS_PORT`       | `3000`               | Compose: the host port.                                     |

Theme, timezone and the first day of the week are stored **in the database**
(Settings) so they apply to date grouping on the server, not just in the UI.

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
│   │   ├── today/ upcoming/ tasks/ completed/
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

- Single user, no authentication, no accounts, no sharing — see the security
  notice above.
- One instance with one SQLite database. Horizontal scaling is not supported.
- One level of subtasks, and one category per task. Labels and priorities were
  removed from the product; a task is grouped by its category and dates.
- No recurring tasks, reminders, notifications or calendar sync.
- Subtasks have a title and a status only (no notes, dates or categories).
- All top-level tasks are loaded for the current page and grouped in the browser;
  this is comfortable for personal volumes and keeps the UI responsive.
- Undo is available for deletions and for failed saves, not for edits.

## License

[MIT](LICENSE) © Kairos contributors.
