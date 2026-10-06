# Deploying Kairos — Docker vs Vercel, databases, and free options

> Scope: this document is about **where Kairos runs and where its data lives**.
> It assumes v1 as shipped (SQLite + Prisma, single instance, **no authentication**).

---

## 0. TL;DR

| You want… | Use | Data layer | Cost |
| --- | --- | --- | --- |
| Least change, keep SQLite | **Docker** on a VPS / home server / Fly.io / Render | SQLite file on a volume | free (own hardware) → ~€4/mo (VPS) |
| ✅ **CHOSEN** — Vercel (serverless) | **Vercel + Supabase Postgres** | Postgres | free tiers exist |
| Vercel but SQLite-compatible | **Vercel + Turso (libSQL)** | libSQL over HTTP | free tier exists |
| Truly free + private | Home server / Raspberry Pi + Tailscale or Cloudflare Tunnel | SQLite file on local disk | free |

**Key rule:** Vercel cannot run your Docker image, and it cannot host a SQLite file. Choose *either* container *or* serverless — not both.

> **➡️ Decision: Vercel + Supabase.** The concrete, step-by-step runbook is
> **[§10](#10-chosen-path--vercel--supabase-runbook)**. Sections 4–6 remain as
> background and alternatives.

---

## 1. The constraint that decides everything

Kairos v1 is designed as **one long-running process with one database file on a writable disk**:

- `prisma/schema.prisma` → `provider = "sqlite"`, `url = env("DATABASE_URL")` (a `file:` path)
- `docker/entrypoint.sh` → runs `prisma migrate deploy`, then `next start -H 0.0.0.0`
- `Dockerfile` → `VOLUME ["/data"]`, DB at `file:/data/kairos.db`
- `src/server/db.ts` → one Prisma client per process, throws if `DATABASE_URL` is missing
- README → "One instance only. Do not scale this service horizontally."

Serverless (Vercel) gives you **no persistent disk** and **many short-lived processes**. So the file-based SQLite model is fundamentally incompatible. That is the whole story — everything below is just the two honest ways to resolve it.

---

## 2. Docker vs Vercel — what actually differs

### Docker (what you already have)

```
Dockerfile ──docker build──▶ IMAGE ──docker run──▶ CONTAINER
   (recipe)                 (immutable snapshot)   (running process)
                                   │
                                   └── + VOLUME /data  (the SQLite file, persists)
```

- The **image** contains: Node 22, `node_modules`, the compiled `.next` build, the Prisma CLI and schema. It is self-contained and portable.
- The **container** is a long-lived process you can SSH into, that writes to a real disk (`/data`).
- You control the port, the OS user (`node`), the healthcheck and when migrations run (`entrypoint.sh`).

### Vercel

- Vercel is **not a container host**. It ignores your `Dockerfile`.
- It reads your **source**, detects Next.js, runs install + `next build`, and deploys:
  - static assets → CDN,
  - server code (Server Components, Server Actions, route handlers) → **serverless/edge functions** that spin up per request.
- Consequences for Kairos:
  - `/tmp` is writable but **ephemeral and per-invocation** → a SQLite file there disappears/virtualizes → data loss and "database not found" errors.
  - No `entrypoint.sh` → `prisma migrate deploy` never runs automatically.
  - No shared memory between invocations → the "one process" assumption in `src/server/db.ts` no longer holds.
  - Your `next start -H 0.0.0.0` command is irrelevant; Vercel runs its own runtime.
  - ⚠️ The deployment URL is **public by default** and Kairos has **no auth** (see §7).

### Side-by-side

| Concern | Docker image | Vercel |
| --- | --- | --- |
| Deploy unit | Image (built once, run anywhere) | Source (rebuilt by Vercel) |
| Process lifetime | Long-lived process | Per-request functions |
| Persistent disk | ✅ `VOLUME /data` | ❌ (`/tmp` is ephemeral) |
| SQLite file | ✅ native fit | ❌ does not work |
| Migrations | `entrypoint.sh` on start | must run out-of-band (CI/CLI) |
| Horizontal scaling | ❌ (by design) | ✅ but SQLite forbids it anyway |
| Your Dockerfile used? | ✅ | ❌ |
| Public URL / TLS | you add it | ✅ automatic |

**Verdict:** pick Docker if you want zero code change. Pick Vercel only if you also move the database to a network service.

---

## 3. What breaks on Vercel (checklist)

If you go Vercel, these must change:

| File / item | Why it breaks | Action |
| --- | --- | --- |
| `prisma/schema.prisma` (`sqlite`) | no local file | switch `provider` to `postgresql` (or use libSQL adapter) |
| `DATABASE_URL=file:/data/...` | no `/data` | point to hosted DB connection string |
| `docker/entrypoint.sh` | never runs | run `prisma migrate deploy` from CI or locally against the hosted DB |
| `prisma/migrations/*/migration.sql` | SQLite-specific SQL | generate a **fresh** initial migration for Postgres |
| Build-time access | `src/server/db.ts` throws without `DATABASE_URL`; pages may prerender | set `DATABASE_URL` in Vercel **for all environments** (build included) |
| `next.config.ts` CSP | `connect-src 'self'` blocks browser→DB calls | keep all DB access **server-side** (it already is) |
| `NEXT_PUBLIC_APP_URL` | canonical/OG URLs | set to your `*.vercel.app` (or custom) domain |
| `/api/health` | fine to keep | ensure the DB is reachable, or it returns 503 |
| Auth | none | **add authentication** before making it public (§7) |

> Postgres detail: because the committed migrations are SQLite SQL, you can't `migrate deploy` them onto Postgres. Since the hosted DB starts empty, delete `prisma/migrations/` and create one new `prisma migrate dev --name init` against Postgres.

---

## 4. Path A — Docker / self-host (keep SQLite)

**Code changes needed: none.** Just `docker compose up -d --build`.

Requires a host with a **persistent volume**:

| Host | Free? | Notes |
| --- | --- | --- |
| Home server / Raspberry Pi | ✅ free | Best fit. Keep it on your LAN/VPN. |
| Oracle Cloud "Always Free" ARM VM | ✅ free | ~4 vCPU/24 GB ARM; you run Docker yourself. |
| Google Cloud e2-micro | ✅ always-free tier | Small; region-restricted. |
| Fly.io | pay-as-you-go (tiny) | Real volumes + Docker deploys; no true free plan anymore. |
| Render | free web service, but **disk only on paid** | Free tier has no persistent disk → data loss. Avoid for SQLite. |
| Railway / Koyeb | trial/limited free | Volumes usually need a paid plan. |
| Hetzner / any VPS | ~€4/mo | Simplest reliable option. |

**Private access without exposing the app** (it has no auth):

- **Tailscale** (free personal tier) — reach the container over your tailnet only.
- **Cloudflare Tunnel** (free) — no open ports, optional Cloudflare Access for a login gate.
- Keep `KAIROS_BIND_HOST=127.0.0.1` and never publish the port to the internet.

If you *must* expose it publicly, put authentication in front (reverse proxy basic auth, Cloudflare Access, or add real auth to the app).

---

## 5. Path B — Vercel + hosted database

### 5a. Vercel + Postgres (recommended for serverless)

Use a serverless-friendly Postgres: **Neon** or **Supabase** (both have free tiers, both provide pooled connection strings).

Changes:

1. `prisma/schema.prisma`:
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```
2. Reset migrations for Postgres:
   ```bash
   rm -rf prisma/migrations
   bunx prisma migrate dev --name init        # against the hosted DB
   ```
3. Set env in Vercel (Production + Preview + Development):
   - `DATABASE_URL` = Neon/Supabase **pooled** connection string
   - `NEXT_PUBLIC_APP_URL` = `https://<your-app>.vercel.app`
4. Deploy. Migrations are **not** run by Vercel — run `bunx prisma migrate deploy` from CI or your machine whenever the schema changes.
5. Server code is unchanged: `src/server/db.ts`, services and Server Actions all keep working; only the datasource changed.

> Prisma + serverless tip: for Neon, consider the Neon serverless driver adapter to avoid exhausting connections. Keep `serverExternalPackages: ["@prisma/client", "prisma"]` in `next.config.ts` (already set).

### 5b. Vercel + Turso (libSQL — SQLite-compatible)

Lets you keep SQLite semantics with a remote, replicated database.

- Provider stays `"sqlite"`, but Prisma talks to Turso through a **driver adapter** (`@prisma/adapter-libsql` + `@libsql/client`), enabling `driverAdapters` in the Prisma generator for your version.
- `src/server/db.ts` must construct `PrismaClient({ adapter })` instead of a bare client.
- Schema and most queries port over; migrations are pushed with Turso's CLI or `prisma migrate`.
- More moving parts than Postgres → choose it only if you specifically want SQLite.

Sketch:
```ts
import { createClient } from "@libsql/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";

const libsql = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

export const prisma = new PrismaClient({ adapter: new PrismaLibSQL(libsql) });
```
*(Exact adapter API/version flags vary — check the Prisma docs for your Prisma 6.x release.)*

---

## 6. Free options compared

> Free tiers change often — verify limits before committing.

| Option | App hosting | Persistent DB | Free? | Auth included? |
| --- | --- | --- | --- | --- |
| **Docker + home server/Pi** | you | SQLite file | ✅ | ❌ (use Tailscale) |
| **Oracle Cloud Always Free VM** | Docker | SQLite file | ✅ | ❌ |
| **Vercel + Neon** | Vercel serverless | Postgres | ✅ (Hobby) | ❌ — add your own |
| **Vercel + Supabase** | Vercel serverless | Postgres | ✅ | Supabase Auth available |
| **Vercel + Turso** | Vercel serverless | libSQL | ✅ | ❌ |
| **Render (free web svc)** | Render | ❌ no free disk | ⚠️ | ❌ |
| **Fly.io** | Docker + volumes | volume | 💲 small | ❌ |

### Scraping / TL;DR of "what can I actually do for free"

1. **Best free + private:** Docker on a home machine or Raspberry Pi, exposed only via **Tailscale** or **Cloudflare Tunnel**. Zero code change, SQLite stays.
2. **Best free + public URL:** **Vercel (Hobby) + Neon free Postgres**. Requires the Postgres migration (§5a) **and authentication** (§7), because the URL is public.
3. **Avoid:** any "free" host **without a persistent disk** if you keep SQLite — your data will vanish.

---

## 7. Security — read before deploying anywhere public

- Kairos v1 has **no authentication**. A public URL = anyone can read/change/delete **every** task.
- Vercel deployments are **public by default** (protection is a paid feature).
- Mitigations:
  - Keep it private (Tailscale / Cloudflare Access / LAN only), **or**
  - Add auth (NextAuth/Auth.js, Clerk, or a middleware password gate), **or**
  - Set `KAIROS_NO_INDEX=true` (stops search engines, but **does not** secure it).
- Backups: exported JSON and the SQLite file are private data — never commit them (`.gitignore` already excludes `*.kairos.json` and `backups/`).

---

## 8. Env variables quick reference

| Variable | Docker (Compose) | Vercel |
| --- | --- | --- |
| `DATABASE_URL` | `file:/data/kairos.db` | Postgres/Turso URL (**all** envs, incl. build) |
| `PORT` | `3000` | managed by Vercel |
| `KAIROS_BIND_HOST` / `KAIROS_PORT` | `127.0.0.1` / `3000` | n/a |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` | `https://<your-app>.vercel.app` |
| `KAIROS_NO_INDEX` | `false` | `true` for a private deployment |

---

## 9. Decision flow

```mermaid
flowchart TD
  A[Where to deploy Kairos?] --> B{Want zero code change\nand keep SQLite?}
  B -- Yes --> C[Use the Docker image\non a host WITH a persistent disk]
  C --> C1[Home server / Pi / Oracle Free VM]
  C --> C2[Fly.io / VPS if you'll pay a little]
  B -- No, I want Vercel --> D[Swap SQLite for a hosted DB]
  D --> D1[Postgres: Neon / Supabase]
  D --> D2[libSQL: Turso]
  D1 --> E[Run prisma migrate deploy from CI]
  D2 --> E
  E --> F[Add authentication + set NEXT_PUBLIC_APP_URL]
  F --> G[Deploy to Vercel]
```

---

## 10. Chosen path — Vercel + Supabase (runbook)

Supabase provides the managed **Postgres** for the data and, optionally, the login
gate Kairos v1 lacks. Vercel runs the Next.js app. Neither keeps a file on disk,
so the SQLite design in §1 is retired on this path.

> **Status:** the repository changes in §10.1 are **already applied** — see
> §10.15 for the file list and the five steps that remain (all of them in
> Supabase and Vercel, none of them in this codebase).

### 10.0 What this decision costs you

- **The Docker/SQLite deployment is retired (or must be maintained separately).**
  Prisma's `provider` is compile-time, so one schema cannot be `sqlite` locally and
  `postgresql` on Vercel. Choose Postgres *everywhere*.
- **All existing migrations are replaced.** `prisma/migrations/*` is SQLite SQL and
  cannot be applied to Postgres. You create one fresh `init` migration; the Supabase
  database is empty, so nothing is lost.
- **Auth is new work.** The app has no users; Supabase Auth is added as an access
  gate (the data model stays single-user).

### 10.1 Change map (all applied — see §10.15)

| Item | Change |
| --- | --- |
| `prisma/schema.prisma` | `provider = "postgresql"`, add `directUrl`, add Prisma `binaryTargets` |
| `prisma/migrations/` | delete, regenerate a single `init` migration |
| `.env` / `.env.example` | `DATABASE_URL` + `DIRECT_URL` point at Supabase |
| `compose.yaml` | optional: swap the app service for a local Postgres in dev |
| `next.config.ts` | add the Supabase origin to `connect-src` |
| `src/middleware.ts`, `src/app/login/`, `src/lib/supabase/*` | **new** — Supabase Auth gate |
| `package.json` | add `@supabase/supabase-js`, `@supabase/ssr` |
| `docker/entrypoint.sh`, `Dockerfile` | unused on Vercel; keep only if you also keep the container path |

### 10.2 Create the Supabase project

1. supabase.com → **New project**. Pick the region closest to your Vercel region
   (for example `eu-central-1` / Frankfurt, or `us-east-1` for both).
2. Save the **database password**.
3. Free-tier note: 500 MB database, and **free projects pause after ~1 week of
   inactivity** (restore from the dashboard). A paused project makes the app
   return 503 on `/api/health`.

### 10.3 The two connection strings (important)

Supabase exposes a **pooler (Supavisor)** because serverless functions open many
short-lived connections. You need both strings.

| Purpose | Port | Notes |
| --- | --- | --- |
| **Runtime / serverless** — `DATABASE_URL` | **6543** (transaction mode) | add `?pgbouncer=true&connection_limit=1` |
| **Migrations** — `DIRECT_URL` | **5432** (session mode / direct) | no pooler; required by `prisma migrate` |

Project → **Connect** (or Settings → Database → Connection string):

```bash
# runtime (pooled, transaction mode)
DATABASE_URL="postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1&sslmode=require"

# migrations (session mode / direct)
DIRECT_URL="postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres?sslmode=require"
```

> Never commit these. `.env` is already in `.gitignore`.

### 10.4 Prisma: switch to Postgres

`prisma/schema.prisma`:

```prisma
generator client {
  provider      = "prisma-client-js"
  // Vercel's build/runtime image needs the Linux target; "native" keeps local dev working.
  binaryTargets = ["native", "rhel-openssl-3.0.x"]
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  // Bypasses the pooler for migrations (see §10.3).
  directUrl = env("DIRECT_URL")
}
```

The models, indexes and relations are unchanged — no model edits are needed.

### 10.5 The fresh migration (already generated)

The SQLite migrations were removed and replaced by a single Postgres one,
`prisma/migrations/20261006120000_init/`. Regenerating it from scratch would be:

```bash
cd kairos
# .env now holds the Supabase DATABASE_URL + DIRECT_URL from §10.3

rm -rf prisma/migrations          # SQLite SQL — cannot run on Postgres
bunx prisma migrate dev --name init
```

`migrate dev` uses `DIRECT_URL`, creates `prisma/migrations/<ts>_init/migration.sql`
(Postgres SQL) and applies it to Supabase. You do not need to do this — the
committed migration only has to be *applied*:

Apply it again later without changing the schema:

```bash
bunx prisma migrate deploy        # also uses DIRECT_URL
```

> `/api/health` calls `prisma.settings.count()`. Run `migrate deploy` **before**
> the first Vercel deploy or the healthcheck returns 503.

### 10.6 Local development after the switch

Local dev must now use Postgres too. Simplest option: a throw-away Postgres in
Compose.

```yaml
# compose.yaml (dev)
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: kairos
      POSTGRES_PASSWORD: kairos
      POSTGRES_DB: kairos
    ports: ["5432:5432"]
    volumes: [kairos-pg:/var/lib/postgresql/data]

volumes:
  kairos-pg:
```

`.env` for local development:

```bash
DATABASE_URL="postgresql://kairos:kairos@localhost:5432/kairos"
DIRECT_URL="postgresql://kairos:kairos@localhost:5432/kairos"
```

Then `bun run dev` as before. (Alternatively, point local dev at a second, free
Supabase project used only for development.)

`.env` in this repository already points at that Compose database, so the local
loop is two commands:

```bash
docker compose up -d db        # PostgreSQL only, no app container
bun run dev
```

The same `db` service creates `kairos_e2e`, the throw-away database the
Playwright suite resets on every run (§10.15).

#### No Docker? Use a locally installed PostgreSQL

This is the case on a machine where the Docker daemon is not running but a
native PostgreSQL server already listens on 5432. Prisma then fails with a
privilege error rather than "connection refused", which is confusing:

```
FATAL:  role "kairos" does not exist

Invalid `prisma.settings.findUnique()` invocation:
User was denied access on the database `(not available)`
```

Create the role and the two databases once, as a PostgreSQL superuser:

```bash
sudo -u postgres psql -c "CREATE ROLE kairos WITH LOGIN PASSWORD 'kairos' CREATEDB;"
sudo -u postgres psql -c "CREATE DATABASE kairos OWNER kairos;"
sudo -u postgres psql -c "CREATE DATABASE kairos_e2e OWNER kairos;"   # Playwright
```

Then, in the project:

```bash
bunx prisma migrate deploy
bun run dev
```

On a shared cluster, drop `CREATEDB` and create `kairos_e2e` yourself.

##### `ERROR: template database "template1" has a collation version mismatch`

On a machine where glibc was upgraded after the cluster was initialised (for
example 2.43 → 2.44), PostgreSQL refuses `CREATE DATABASE`:

```
WARNING:  database "postgres" has a collation version mismatch
ERROR:    template database "template1" has a collation version mismatch
DETAIL:   The template database was created using collation version 2.43,
          but the operating system provides version 2.44.
```

`CREATE DATABASE` copies `template1`, so **every** new database fails until the
template is re-stamped. Two ways out:

```bash
# 1. Canonical (needs a superuser): re-stamp the templates, then create normally.
sudo -u postgres psql -c "ALTER DATABASE template1 REFRESH COLLATION VERSION;"
sudo -u postgres psql -c "ALTER DATABASE postgres  REFRESH COLLATION VERSION;"
sudo -u postgres psql -c "CREATE DATABASE kairos OWNER kairos;"

# 2. No superuser: copy template0, which has no recorded collation version to
#    disagree with, so the check is skipped.
psql "postgresql://kairos:kairos@localhost:5432/postgres" \
  -c "CREATE DATABASE kairos OWNER kairos TEMPLATE template0"
```

Prefer (1) — it keeps the cluster consistent. Use (2) when you only have a login
role with `CREATEDB`. `REFRESH COLLATION VERSION` is safe: it re-stamps the
version without touching your own databases.

### 10.7 Vercel project

1. Push the repo to GitHub, then **Vercel → Add New → Project → Import**.
2. Framework preset: **Next.js** (auto-detected). Leave the install/build commands
   alone — `package.json` already runs `prisma generate` via `postinstall`, and
   `build` is `prisma generate && next build`.
3. **Environment Variables** — set for *Production*, *Preview* and *Development*:

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | pooled Supabase URL (§10.3) |
| `DIRECT_URL` | session/direct Supabase URL (§10.3) |
| `NEXT_PUBLIC_APP_URL` | `https://<your-app>.vercel.app` (or your domain) |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<ref>.supabase.co` (auth, §10.9) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key (auth, §10.9) |
| `KAIROS_ALLOWED_EMAILS` | Comma-separated sign-in allowlist (auth, §10.9) |
| `KAIROS_NO_INDEX` | `false` (or `true` for a private deployment) |

> `NEXT_PUBLIC_*` values are **inlined at build time** — set them before the first
> build or they will be `undefined` in the browser bundle.
>
> Pages read the database during prerender, so `DATABASE_URL`/`DIRECT_URL` are
> needed at **build time** as well. Setting them for all environments covers this.

### 10.8 Migrations vs. deploys

Vercel preview deployments each build, but they must **not** run destructive
migrations. Run migrations yourself, once, against Supabase:

```bash
bunx prisma migrate deploy
```

Best options, in order: a manual/CI step before merging, a GitHub Action on `main`,
or `supabase db push` if you adopt the Supabase CLI. Keep it out of the Vercel build
command so previews never race the production database.

### 10.9 Authentication (Supabase Auth) — the new piece

Kairos v1 has no user model, so Supabase Auth is an **access gate**, not
multi-tenancy: it decides who may touch the one shared workspace. A Vercel URL is
public, so the gate matters there.

The code is already in place:

| File | Role |
| --- | --- |
| `src/lib/supabase/server.ts` | `createServerClient` bound to Next cookies |
| `src/lib/supabase/client.ts` | `createBrowserClient` for the sign-in form |
| `src/middleware.ts` | refreshes the session, redirects to `/login`, drops a non-allowlisted session |
| `src/server/auth.ts` | `requireUser()` guard used by the app shell and `/api/backup` |
| `src/lib/auth-rules.ts` | the allowlist rule (shared with the edge middleware, unit tested) |
| `src/app/login/` | the email + password sign-in page |
| `src/server/actions/auth.ts` | `signOutAction`, wired to the sidebar's **Sign out** |

The gate is **inert when Supabase is not configured**, and
`KAIROS_AUTH_DISABLED=true` forces the same behaviour — that is how local
development and the Playwright suite keep running without credentials.

What you have to do in Supabase:

1. **Authentication → Providers → Email**: enable it and turn **off** public
   sign-ups (you are the only user).
2. Create your user under **Authentication → Users**.
3. Set `KAIROS_ALLOWED_EMAILS` to your address so a leaked sign-up still cannot
   get in.
4. `.env` (and Vercel's env vars):

```bash
NEXT_PUBLIC_SUPABASE_URL="https://<ref>.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="<anon key>"
KAIROS_ALLOWED_EMAILS="you@example.com"
```

> The data model stays single-user — auth gates access, it does not partition
> data. Adding a real `userId` column and per-user filtering is a separate
> feature.

If you would rather not use the gate, leave the Supabase URL empty (the app then
behaves as before) and keep the deployment private instead (§7).

### 10.10 Content-Security-Policy

Supabase Auth runs in the browser, so the CSP in `next.config.ts` must allow the
Supabase origin:

```ts
const supabaseOrigin = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const connectSrc = ["'self'", supabaseOrigin, supabaseOrigin.replace(/^http/, "ws")]
  .filter(Boolean)
  .join(" ");
// ...
`connect-src ${connectSrc}`,
```

Keep the rest of the policy as-is: `/api/health` and all data access stay
server-side.

### 10.11 Smoke test

```bash
# 1. local, against Postgres
bun run typecheck && bun test
bun run dev        # create a task, reload, confirm it persists

# 2. after deploying
curl -s https://<your-app>.vercel.app/api/health      # {"ok":true,"database":"ok"}
```

Then in the browser: sign in, create and complete a task, export a JSON backup,
and reload to confirm the data persisted (Supabase → Table editor → `Task`).

### 10.12 Backups change shape

- The **SQLite file-copy** method from the README no longer applies.
- The app's **JSON export/import** is unchanged and remains the easiest backup.
- Database-level: `pg_dump "$DIRECT_URL" > kairos-$(date +%F).sql`, or Supabase's
  own backup/restore (paid tiers keep longer history).

### 10.13 Rollback

The old Docker/SQLite deployment still works from a tag or branch taken *before*
the switch — but one Prisma schema cannot serve both providers. Decide, then delete
`prisma/migrations/` and regenerate for the provider you keep. Take a JSON export
before switching (§10.12) so the data can be re-imported.

### 10.14 Checklist

- [ ] Supabase project created (region near Vercel), password saved
- [ ] `DATABASE_URL` (6543, pooled) and `DIRECT_URL` (5432) collected
- [ ] `schema.prisma`: `postgresql` + `directUrl` + `binaryTargets`
- [ ] `prisma/migrations/` regenerated (`init`) and committed
- [ ] `bunx prisma migrate deploy` run against Supabase
- [ ] local dev moved to Postgres
- [ ] Vercel env vars set for Production + Preview + Development
- [ ] `NEXT_PUBLIC_APP_URL` set to the real origin
- [ ] Supabase Auth added, sign-ups disabled, your user created and allowlisted
- [ ] CSP `connect-src` includes the Supabase origin
- [ ] `/api/health` returns `{"ok":true}` on the deployment
- [ ] JSON backup exported before and after the switch

### 10.15 Already applied in this repository

The code side of this runbook is done; what remains is Supabase and Vercel.

| Change | Where |
| --- | --- |
| Postgres datasource, `directUrl`, Prisma `binaryTargets` | `prisma/schema.prisma` |
| One Postgres `init` migration (replaces the SQLite ones) | `prisma/migrations/20261006120000_init/` |
| Postgres for local dev and self-hosting | `compose.yaml`, `docker/postgres-init/` |
| Database is external to the image (no `/data` volume) | `Dockerfile`, `docker/entrypoint.sh` |
| Supabase clients | `src/lib/supabase/server.ts`, `src/lib/supabase/client.ts` |
| Allowlist rule + unit tests | `src/lib/auth-rules.ts`, `tests/unit/auth-rules.test.ts` |
| Access gate | `src/server/auth.ts`, `src/middleware.ts`, `src/app/(app)/layout.tsx`, `src/app/api/backup/route.ts` |
| Sign-in page and sign-out control | `src/app/login/`, `src/components/layout/sidebar.tsx`, `src/server/actions/auth.ts` |
| Supabase origin in the CSP | `next.config.ts` |
| Environment reference | `.env.example`, `.env` |
| e2e suite against Postgres | `playwright.config.ts` |

**What you still have to do:**

1. Create the Supabase project and copy both connection strings (§10.2–§10.3).
2. Put them in `.env` (local) and in Vercel's environment variables (§10.7).
3. Run `bunx prisma migrate deploy` against Supabase (§10.5).
4. Enable Email auth, disable sign-ups, create your user, set
   `KAIROS_ALLOWED_EMAILS` (§10.9).
5. Deploy.

> **Tests.** The Playwright suite now needs PostgreSQL at `E2E_DATABASE_URL`
> (default `postgresql://kairos:kairos@localhost:5432/kairos_e2e`, created for you
> by `docker compose up -d db`). It runs with `KAIROS_AUTH_DISABLED=true`, so no
> Supabase session is required. `bun run test:e2e` still builds first, so
> `DATABASE_URL` must be set for that build.