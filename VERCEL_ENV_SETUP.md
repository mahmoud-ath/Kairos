# Vercel environment variables — detailed setup

> ⚠️ **Superseded.** For a new deployment use
> **[docs/README.md](docs/README.md)**, and
> [docs/deployment.md](docs/deployment.md) §6 for this specific topic.
>
> Kept as a reference for the environment-variable form specifically: the
> dashboard and CLI alternatives, the paste traps, and a per-error troubleshooting
> table. The project name below refers to one particular deployment.

---

## 0. What the log already told us

```
22:24:19.88  info   ε GET /      307          ← redirects to /today
22:24:19.91  error  λ GET /today 500  Error [Pr…
```

`Error [Pr…` is the truncated form of **`PrismaClientInitializationError`**, and the
failure happens on *every* request. The untruncated log line names the real cause:

```
prisma:error Invalid `prisma.settings.count()` invocation:
Can't reach database server at `localhost:5432`
```

**Vercel's `DATABASE_URL` is still the development value from `.env`.** There is no
database on `localhost` inside a Vercel function, so every request fails.

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")   // ← must be the POOLED Prisma Postgres host
  directUrl = env("DIRECT_URL")     // ← the direct host, for migrations only
}
```

> Note on `DIRECT_URL`: Prisma Client does **not** validate it at runtime — a
> missing `DIRECT_URL` breaks `prisma migrate`, not the running app. Set it anyway;
> it is what makes step 3 (applying the migrations) possible.

This document walks through setting both correctly.

---

## 1. Collect the two connection strings

Prisma Postgres exposes **one database through two hostnames**. The credentials
are identical; only the host differs.

### 1.1 Open the right console

From your Vercel project: **Project → Storage** (or **Integrations**) → the
**Prisma** entry → **Open in Prisma Console**. That lands you on the database the
integration provisioned, without hunting through workspaces.

Directly: <https://console.prisma.io> → pick the workspace → **Databases**.

### 1.2 Generate / reveal the strings

In the Prisma Console:

1. Select your database.
2. Click **Connect to your database**.
3. Click **Generate new connection string**.
4. Copy **both** strings — *pooled* and *direct*.

They look like this:

```bash
# Pooled — application traffic
postgres://<your-user>:<your-password>@pooled.db.prisma.io:5432/postgres?sslmode=require

# Direct — migrations and admin tooling
postgres://<your-user>:<your-password>@db.prisma.io:5432/postgres?sslmode=require
```

> The angle brackets are placeholders. The real username is a long random hex
> string and the password starts with `sk_` — copy them from the Console. A string
> still containing `USER`, `PASSWORD` or `…` will fail with
> `P1001 Can't reach database server`, which looks like a network error but is not.

### 1.3 How to tell them apart

| Hostname | Which one | Goes into |
| --- | --- | --- |
| `pooled.db.prisma.io` | has the word **pooled** | `DATABASE_URL` |
| `db.prisma.io` | no "pooled" | `DIRECT_URL` |

Both use **port 5432** and both must end with **`?sslmode=require`**. If a string
you copied is missing `sslmode`, add it — connections are rejected without it.

> **Shortcut.** Since the credentials are shared, you can build the second string
> from the first by changing the hostname: take the `DATABASE_URL` value and
> replace `pooled.db.prisma.io` with `db.prisma.io`. Same user, same password,
> same port, same `?sslmode=require`. This is handy if the console only shows you
> one string at a time.

> **Check the case of `USER`.** Prisma Postgres generates usernames that are often
> mixed case (`postgres.xxxxXXXx`). Copy them character for character — they are
> part of the credential.

---

## 2. Verify the strings *before* touching Vercel

Fixing this in one pass beats redeploying three times. Use the **direct** string,
which is the one that unlocks everything else.

```bash
# 1. Can we reach the database at all?
psql "postgres://USER:PASSWORD@db.prisma.io:5432/postgres?sslmode=require" \
  -c 'select version()'

# 2. What tables currently exist?
psql "postgres://USER:PASSWORD@db.prisma.io:5432/postgres?sslmode=require" -c '\dt'
```

- **`select version()` fails** → the string is wrong (usually a typo in the user,
  password, or a missing `sslmode=require`). Fix it here first.
- **`\dt` lists nothing** → expected on a fresh database. That is step 3 of the
  roadmap (`bunx prisma migrate deploy`), not a problem with the strings.
- **`\dt` lists `Task`, `Category`, `TaskEvent`, `Settings`** → migrations already
  ran; you can skip step 3.

---

## 3. The variables to create

| Variable | Value | Required? | If missing |
| --- | --- | --- | --- |
| `DATABASE_URL` | the **pooled** string | yes | the app cannot reach the database at all |
| `DIRECT_URL` | the **direct** string | for migrations | `prisma migrate` cannot run; the running app is unaffected |
| `NEXT_PUBLIC_APP_URL` | `https://kairos-zeta-ivory.vercel.app` | recommended | canonical/OG URLs and `sitemap.xml` fall back to `http://localhost:3000` |

Scope **all three** to **Production, Preview and Development**.

---

## 4. Option A — add them in the Vercel dashboard

1. Open the project → **Settings** → **Environment Variables**.
2. Note what already exists. You should see `DATABASE_URL` marked as coming from
   the **Prisma** integration. Integration variables are **managed by the
   integration** — don't try to edit or delete it; you only need to *add* the
   missing ones.
3. Click **Add New** (or *Create New*) for the first variable:
   - **Key:** `DIRECT_URL`
   - **Value:** the **direct** string
   - **Environments:** tick **Production**, **Preview** and **Development**
   - Leave **Sensitive** *on* if offered — the value is then write-only, which is
     fine because you never need to read it back.
4. **Save**.
5. Repeat for `NEXT_PUBLIC_APP_URL` with value
   `https://kairos-zeta-ivory.vercel.app`.

### ⚠️ Two paste errors that cause the next 500

- **Do not wrap the value in quotes.** In a `.env` file you write
  `DATABASE_URL="postgres://…"`. In the Vercel dashboard the field is the literal
  value — if you paste the quotes they become part of the URL and Prisma reports
  an invalid connection string.
- **Do not copy a trailing space or newline.** Select the string exactly; a stray
  trailing character is invisible in the UI.

---

## 5. Option B — add them with the Vercel CLI

Faster, and it keeps the secret out of your shell history because the CLI prompts
for the value:

```bash
cd /home/mgkali/Desktop/kairos_web_app

# Add DIRECT_URL to all three environments
npx vercel env add DIRECT_URL production
npx vercel env add DIRECT_URL preview
npx vercel env add DIRECT_URL development

# Same for the public app URL (not secret, so inline is fine)
printf 'https://kairos-zeta-ivory.vercel.app' | npx vercel env add NEXT_PUBLIC_APP_URL production
printf 'https://kairos-zeta-ivory.vercel.app' | npx vercel env add NEXT_PUBLIC_APP_URL preview
```

Each `vercel env add` prompts `What's the value of DIRECT_URL?` — paste the direct
string and press Enter. It deliberately does not echo the value.

Useful checks:

```bash
npx vercel env ls                       # which variables exist, and where
npx vercel env pull .env.vercel.local   # download them locally (gitignored)
```

> `vercel env ls` shows names and environments but not values for sensitive
> variables — that is expected, not a sign the value is missing.

---

## 6. Redeploy — env changes do **not** apply to existing deployments

A deployment captures its environment at build time. Adding variables afterwards
changes nothing until you ship a new deployment.

```bash
npx vercel --prod
```

Or in the dashboard: **Deployments → … → Redeploy** (keep *Use existing Build
Cache* unchecked when you want the new `NEXT_PUBLIC_*` value baked in — build
caching can otherwise reuse the old inlined value).

---

## 7. Verify

```bash
# 1. Is the database reachable from the deployed app?
curl -s https://kairos-zeta-ivory.vercel.app/api/health
# → {"ok":true,"database":"ok"}

# 2. Watch the logs while you load the app
npx vercel logs https://kairos-zeta-ivory.vercel.app
```

Then open `https://kairos-zeta-ivory.vercel.app/today` and create a task.

| Result | Meaning |
| --- | --- |
| `{"ok":true,"database":"ok"}` and pages load | ✅ fixed |
| `{"ok":false,"database":"error"}` (HTTP 503) | the database is reachable in config but the query failed — read the logs |
| Still `500 … Digest` | read the new log line; see the table below |
| `307` to `/login` | you enabled the auth gate — expected (DEPLOYMENT.md §10.9) |

---

## 8. Troubleshooting the next error

Re-read the runtime logs; the digest changes but the message names the cause.

| Log message | Cause | Fix |
| --- | --- | --- |
| `Can't reach database server at \`localhost:5432\`` | `DATABASE_URL` is still the local development value | paste the **pooled** Prisma Postgres string (§4) |
| `Environment variable not found: DATABASE_URL.` | the integration is not installed on this project | install it from Vercel → Marketplace → Prisma |
| `Environment variable not found: DIRECT_URL.` (from `prisma migrate` only) | migrations need the direct host | add `DIRECT_URL` (§4) — the running app does not need it |
| ``The table `public.Settings` does not exist`` (`P2021`) | `DIRECT_URL` is now fine, but migrations were never applied | `bunx prisma migrate deploy` over the **direct** string |
| `Authentication failed` / `password authentication failed` | wrong password, or quotes/whitespace pasted into the value | re-paste in §4, no quotes |
| `Can't reach database server` / timeout | missing `?sslmode=require`, or the wrong hostname | check the string against §1.3 |
| `prepared statement` / `lock` errors during a migration | the **pooled** string was used for `prisma migrate` | use the **direct** string for all CLI commands |
| `Too many connections` | app traffic is on the **direct** host | `DATABASE_URL` must be the **pooled** string |

### Reading the full error text

The dashboard log line is truncated in the CLI. For the untruncated stack:

**Project → Deployments → (the failing deployment) → Functions → Logs**, then
select the function and expand the `PrismaClientInitializationError` entry.

---

## 9. Checklist

- [ ] Copied **both** Prisma Postgres strings (pooled + direct)
- [ ] Confirmed the direct string with `psql … -c '\dt'`
- [ ] `DATABASE_URL` = pooled host, set for all three environments
- [ ] `DIRECT_URL` = direct host, set for all three environments *(the fix)*
- [ ] `NEXT_PUBLIC_APP_URL` = `https://kairos-zeta-ivory.vercel.app`
- [ ] No quotes, no trailing spaces in any value
- [ ] Migrations applied: `bunx prisma migrate deploy` (roadmap step 3)
- [ ] Redeployed with `npx vercel --prod`
- [ ] `/api/health` returns `{"ok":true,"database":"ok"}`
- [ ] `/today` loads and a task can be created

---

## 10. While you are here: authentication

With no Supabase variables set, the sign-in gate is **inert** and this deployment
is **public** — anyone with the URL can read, change and delete every task.
Enable it per [`DEPLOYMENT.md`](DEPLOYMENT.md) §10.9 (a free Supabase project used
only for Auth; your data stays on Prisma Postgres), or set
`KAIROS_NO_INDEX=true` at minimum so crawlers stay away.
