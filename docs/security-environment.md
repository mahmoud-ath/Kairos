# Protecting the environment

Status: **analysis + plan**, 2026-10-18. Nothing in this document has been
implemented yet; every recommendation is sized, ordered and verifiable.

This is about the *runtime environment* of Kairos — the credentials, flags and
files that decide who the app trusts. It is not a general security review of the
UI, and it deliberately does not repeat the deployment steps that live in
[`deployment.md`](deployment.md).

---

## 1. What "the environment" is here

Kairos learns everything about its deployment from environment variables. There
are only eleven that matter, and they fall into three very different risk classes:

| Variable | Read by | Ships to the browser? | If it leaks |
| --- | --- | --- | --- |
| `DATABASE_URL` | Prisma at runtime | no | **Full read/write of every user's tasks.** Highest blast radius in the app. |
| `DIRECT_URL` | Prisma CLI only (`migrate`, Studio, dump) | no | Same as above, plus DDL (drop tables). |
| `VAPID_PRIVATE_KEY` | `src/server/services/push.ts` | no | Anyone can send notifications *to your subscribers*, and impersonate Kairos to the push services. |
| `KAIROS_CRON_SECRET` / `CRON_SECRET` | `src/server/cron-auth.ts` | no | Anyone can trigger the daily broadcast at will (spam, not data loss). |
| `NEXT_PUBLIC_SUPABASE_URL` | browser + server | **yes, inlined at build** | Nothing. It is the project's public address. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | browser + server | **yes, inlined at build** | Nothing on its own — it is public by design and constrained by Row Level Security / your auth settings. Still: rotate it if abuse is observed. |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | browser + server | **yes, inlined at build** | Nothing. Its whole job is to be public. |
| `KAIROS_AUTH_DISABLED` | `middleware.ts`, `server/auth.ts` | no | **Not a secret — a loaded gun.** `true` on a public deployment removes the gate that keeps accounts apart. |
| `KAIROS_ALLOWED_EMAILS` | `lib/auth-rules.ts` | no | Nothing secret; mis-setting it locks everybody out. |
| `NEXT_PUBLIC_APP_URL` | metadata, sitemap, CSP | **yes, inlined at build** | Nothing. |
| `KAIROS_NO_INDEX` | `robots.ts` | no | Nothing. |

The asymmetry matters: **three of these are not secrets at all**, one is a
security switch with no guard, and the remaining ones are all "lose the database
or lose the push channel" grade.

### Why `NEXT_PUBLIC_*` is a one-way door

Next.js replaces `process.env.NEXT_PUBLIC_X` with a literal string **during
`next build`**. After the build the app does not read the variable again
([Next.js: environment variables](https://nextjs.org/docs/app/guides/environment-variables)).
Two consequences that have already bitten this repo:

- Setting `NEXT_PUBLIC_SUPABASE_URL` in Vercel **without redeploying** changes
  nothing.
- The CSP in `next.config.ts` is compiled from that same value, so the running
  build's Supabase target is visible without any secrets:
  `curl -sI https://kairos-zeta-ivory.vercel.app/login | grep -io "connect-src[^;]*"`.

---

## 2. Verified current state

Checked on 2026-10-18, on this machine and against production.

### 2.1 Repository

| Check | Command | Result |
| --- | --- | --- |
| Which env files are tracked | `git ls-files \| grep -Ei '(^\|/)\.env'` | **`.env.example` only** ✅ |
| History ever contained them | `git --no-pager log --oneline --all -- .env .env.local .env.production.local` | **empty** ✅ |
| Ignore rules | `.gitignore` | `.env`, `.env.local`, `.env.*.local`, and explicit `.env.production` / `.development` / `.staging` / `.test`; `!.env.example` keeps the template ✅ |
| Backup files | `.gitignore` | `*.kairos.json`, `backups/` ✅ |

The ignore list is unusually good: it names the per-environment files as well as
the `.local` pattern, which is exactly the gap most repos fall into.

### 2.2 This machine

```
.env                    postgresql://kairos:kairos@localhost:5432/kairos   (local dev DB)
.env.local              Supabase URL + anon key (development project)
.env.production.local   production DATABASE_URL/DIRECT_URL + push secrets
```

⚠️ **`.env.production.local` holds production credentials in plaintext on a dev
machine.** It is not a code bug and it is not committed, but it has already
caused an incident: `set -a; . ./.env.production.local` exports the production
URLs into the *persistent* shell, after which every later `prisma` or test run in
that terminal targets production. That is how "integration tests ran against
production" happened. See [`troubleshooting.md`](troubleshooting.md).

### 2.3 Production (Vercel + Prisma Postgres + Supabase)

| Control | State |
| --- | --- |
| Env vars for Production / Preview / Development | set, as **Config** (readable in the dashboard, not encrypted-at-rest beyond Vercel's storage) |
| `DATABASE_URL` (pooled) vs `DIRECT_URL` (direct) | distinct and correct; the app only needs `DATABASE_URL` |
| Security headers | `Content-Security-Policy`, `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Cross-Origin-Opener-Policy`, `Permissions-Policy`, `Strict-Transport-Security` — applied to every path in `next.config.ts` |
| Auth gate | **fail closed**: unconfigured + not disabled ⇒ 500 with an actionable message on every route, `/` excepted |
| Cron endpoint | `POST`/`GET` `/api/cron/daily-reminder`, secret compared with `timingSafeEqual`, **refuses everything when no secret is set** |
| Health endpoint | returns `{ok, database}` only — no stack, no version, no host |
| Migration history | 7/7 applied **after** today's repair; Vercel never runs migrations itself |

### 2.4 Findings

Severity is about Kairos the product (personal task data, a few hundred users),
not about a bank.

| # | Severity | Finding | Why it matters |
| --- | --- | --- | --- |
| F1 | **High** | Production credentials sit in `.env.production.local` on the dev box | One careless `source`, one backup, one screen-share away from a full data compromise. Already caused a cross-environment incident. |
| F2 | **High** | `KAIROS_AUTH_DISABLED=true` is honoured with no environment check | A typo in Vercel turns a multi-tenant app into one shared workspace **for everyone on the internet**, and nothing in the app or the health check complains. |
| F3 | **Medium** | No secret scanning, no pre-commit hook, no dependency audit in CI | Nothing stops the next key from being committed, and nothing tells you when a dependency is vulnerable. |
| F4 | **Medium** | One database role does everything (`kairos`) | The runtime role can `DROP TABLE`. A SQL-injection-class bug (none known) escalates from "read rows" to "destroy the database". |
| F5 | **Medium** | No rotation runbook for the four real secrets | Rotation is the only response to a leak, and today it would have to be improvised — including *all* VAPID subscriptions being invalidated. |
| F6 | **Low** | `/api/health` is public and reports DB reachability | Useful to an attacker probing for a live database, marginal value to an operator (Vercel has its own health signal). |
| F7 | **Low** | Backup export is a plaintext JSON of everything | Correct as a feature; worth stating explicitly that the file is as sensitive as the database. |
| F8 | **Low** | `KAIROS_ALLOWED_EMAILS` is still documented although the app is public | The handbook warns about it; the variable remains one copy-paste from locking out real users. |

---

## 3. Research grounding

- **Next.js** — variables are only exposed to the browser when prefixed
  `NEXT_PUBLIC_`, and then *inlined at build time*; the load order is
  `process.env` → `.env.$(NODE_ENV).local` → `.env.local` → `.env.$(NODE_ENV)` →
  `.env`, stopping at the first hit
  ([docs](https://nextjs.org/docs/app/guides/environment-variables)). This is why
  an exported shell variable beats `.env.local` — the trap already recorded in
  the repo notes.
- **OWASP Secrets Management Cheat Sheet** — centralise and standardise; least
  privilege per secret; do not commit; rotate automatically where possible;
  never log secrets; treat CI/CD as production and keep its secrets out of forks
  ([cheat sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)).
- **Vercel** — env vars are scoped per environment (Production / Preview /
  Development) and can be marked *Sensitive* (write-only after creation). Preview
  deployments otherwise inherit Production values, which is a common leak path
  when a branch is shared publicly.

---

## 4. Recommendations, in order

### P0 — do before the next deploy

**P0.1 Refuse to run ungated in production.** The flag is honest about being
local-only; make the code enforce it.

```ts
// src/server/auth.ts
export function isAuthDisabled(): boolean {
  // Never honour the switch on a deployment: a single wrong variable would turn
  // every account's workspace into one shared one.
  if (process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production") {
    return false;
  }
  return process.env.KAIROS_AUTH_DISABLED === "true";
}
```

Caveat to decide first: `next start` on a laptop sets `NODE_ENV=production`, so
gate on `VERCEL_ENV` (or an explicit `KAIROS_ALLOW_UNAUTHENTICATED=1` opt-in) if
you still want the Playwright suite to work — it runs `next start` with
`KAIROS_AUTH_DISABLED=true`.

**P0.2 Stop sourcing production into the shell.** Add a guard script the
incident notes already recommend, and delete `.env.production.local` from the
repo root once the values are in Vercel:

```bash
# scripts/with-prod-env.sh — the ONLY sanctioned way to reach production
set -eu
env_file="${1:-.env.production.local}"
[ -f "$env_file" ] || { echo "missing $env_file" >&2; exit 1; }
# shellcheck disable=SC1090
. "$env_file"
case "${DIRECT_URL:-}" in
  postgres*@db.prisma.io:*) ;;
  *) echo "ABORT: DIRECT_URL does not look like production" >&2; exit 1 ;;
esac
"${@:2}"
```

**P0.3 Secret scanning.** Two layers, both free:
`.gitignore` already covers the files; add `gitleaks` as a pre-commit hook and as
a CI job (see [`ci-cd.md`](ci-cd.md)).

### P1 — next iteration

**P1.1 Split the database roles.** Prisma needs DDL only for `migrate`:

```sql
CREATE ROLE kairos_app LOGIN PASSWORD '…';
GRANT CONNECT ON DATABASE postgres TO kairos_app;
GRANT USAGE ON SCHEMA public TO kairos_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO kairos_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO kairos_app;
```

Then `DATABASE_URL` uses `kairos_app` and `DIRECT_URL` keeps the owner role.
Verified constraint: the app never needs DDL, so this is a drop-in change — but
`prisma migrate deploy` must keep using `DIRECT_URL`.

**P1.2 Mark every server-only variable Sensitive in Vercel** so the dashboard
cannot show it again (`vercel env add NAME production --sensitive`), and keep
Preview scoped to a **branch database**, never the production one.

**P1.3 Health endpoint hardening.** Either require the scheduler secret
(`Authorization: Bearer $KAIROS_CRON_SECRET`) or reduce the body to a bare `200`.
Docker/compose health checks can send the header; Vercel's own monitoring does
not need the route.

### P2 — when there is a second operator

- A secret manager (Doppler / 1Password / Vercel Sensitive + `vercel env pull`)
  with one source of truth, so `.env.production.local` stops existing.
- Rotation on a schedule for the cron secret and VAPID keys (rotation invalidates
  subscriptions — announce it in the UI first).
- Signed backups: HMAC the exported JSON so an imported file can be proven to
  come from Kairos, and encrypt it before it leaves the browser.

---

## 5. Rotation runbook (the part you need at 2 a.m.)

Order matters: rotate the thing that grants the most access first.

| # | Secret | How | Blast radius of the rotation |
| --- | --- | --- | --- |
| 1 | Database password | Prisma Postgres dashboard → reset password → update `DATABASE_URL` **and** `DIRECT_URL` in Vercel → redeploy | None if both are updated together; connections drop briefly |
| 2 | Supabase anon key | Supabase → Settings → API → roll JWT secret | **Every user is signed out.** Announce first |
| 3 | `KAIROS_CRON_SECRET` | `openssl rand -base64 32` → Vercel → redeploy | Scheduler 401s until the new value is in the cron config |
| 4 | VAPID pair | `bunx web-push generate-vapid-keys --json` → update three variables → redeploy | **Every subscription is dead**; every device must re-enable notifications |
| 5 | `.env.production.local` | delete the file, `git log -S` for each value | — |

After any rotation, confirm what the running build actually uses:

```bash
curl -sI https://kairos-zeta-ivory.vercel.app/login | grep -io "connect-src[^;]*"   # Supabase ref
curl -s  https://kairos-zeta-ivory.vercel.app/api/health                            # DB reachable
```

---

## 6. Verification checklist

**Local**

- [ ] `git ls-files | grep -Ei '(^|/)\.env'` prints only `.env.example`
- [ ] `git log --all --oneline -S 'postgresql://'` finds no credential commits
- [ ] `bun run typecheck && bun run lint && bun run test` — 228 unit tests
- [ ] `env -u NEXT_PUBLIC_SUPABASE_URL -u NEXT_PUBLIC_SUPABASE_ANON_KEY bun run dev`
      then `/today` returns **500**, not a shared workspace (gate fails closed)

**Production**

- [ ] `/` 200, `/login` 200, `/today` 307 → `/login`
- [ ] `/api/health` `{"ok":true,"database":"ok"}`
- [ ] `curl -sI .../login` shows CSP, HSTS, `X-Frame-Options: DENY`, and no
      `X-Powered-By`
- [ ] Cron without a secret → **401**, with the secret → 200
- [ ] The page source contains **no** `VAPID_PRIVATE_KEY` and no cron secret
      (`grep -c` on the HTML)
- [ ] Vercel dashboard: Production vars exist for all three scopes; server-only
      ones marked Sensitive

---

## 7. Open questions

1. Do you want unauthenticated local runs at all after P0.1? If yes, the switch
   needs an explicit second env var rather than reusing `NODE_ENV`.
2. Is the health route consumed by anything you control (uptime monitor, Docker
   healthcheck)? That decides whether P1.3 is a header or a body change.
3. Is `.env.production.local` needed on this machine for `vercel env` operations,
   or can it be replaced with `vercel env pull` into a temporary file?
