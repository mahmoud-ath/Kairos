# CI/CD

Status: **analysis + plan**, 2026-10-18. There is no pipeline today; this file
describes what to build and why, in the order that removes the most risk first.

---

## 1. Where Kairos is today

| Fact | Evidence (2026-10-18) |
| --- | --- |
| No CI | `ls -a .github` → no `.github` directory |
| Deploy | Vercel's Git integration: push to `main` → build → deploy |
| Checks | all manual, on one laptop: `typecheck`, `lint`, `test`, `test:integration`, `test:e2e` |
| Migrations | manual `prisma migrate deploy` over the **direct** host, by hand |
| Rollback | Vercel "promote previous deployment" (code only — schema migrations are *not* rolled back) |

The scripts already exist and are fast enough:

```jsonc
"build":            "prisma generate && next build",
"typecheck":        "tsc --noEmit",
"lint":             "eslint .",
"test":             "vitest run",                            // 228 unit tests, ~1 s
"test:integration": "env -u DATABASE_URL -u DIRECT_URL vitest run --config vitest.integration.config.ts",
"test:e2e":         "bun run build && playwright test"        // port 3211, production build
```

So this is not "invent a testing strategy". It is **put the existing strategy
where it cannot be skipped**.

### 1.1 The cost of not having one, measured

Migrations were merged without being applied to production **three times**:

| Date | Symptom | Missing migration |
| --- | --- | --- |
| 2026-10-11 | every `/today` 500 (`P2022`) | `profile_and_category_icon`, `text_scale` |
| 2026-10-13 | every workspace page 500 | `habits` |
| 2026-10-18 | every workspace page 500 (`Digest: 1566724973`) | `push_subscriptions`, `reminder_hour` |

Each was diagnosed from scratch, each was fixed with the same manual
`prisma migrate deploy`, and each time `/api/health` was **green** until it was
hardened. A pipeline with one "apply migrations, then verify the schema" job
would have caught all three before a user saw a 500.

---

## 2. Local vs production: same code, different everything else

| Concern | Local | Vercel |
| --- | --- | --- |
| Database | `localhost:5432/kairos` (native PG 18 on this machine) | Prisma Postgres, pooled + direct hosts |
| Env source | `.env`, `.env.local`, `.env.production.local` | dashboard, per environment |
| `NEXT_PUBLIC_*` | read at build/start | **frozen at build**, a change needs a redeploy |
| Process | one `next dev` | many serverless instances |
| Migrations | you run them | **nothing runs them** |
| E2E | Playwright starts `next start` on 3211 against `kairos_e2e` | not run at all |

Two traps that a pipeline makes visible:

- **`playwright.config.ts` passes `DATABASE_URL=…` inline to
  `prisma migrate reset`**, but `bunx` also loads `.env`; on a machine with a
  `.env`, the reset can target the development database instead of `kairos_e2e`.
  In CI there is no `.env`, so the inline value wins — one more reason to run e2e
  in CI rather than only locally.
- **`next build` fetches Google Fonts** (`next/font/google`). On a runner without
  egress, the build fails for a reason that has nothing to do with the code.

---

## 3. Target pipeline

```mermaid
flowchart LR
  PR["pull request"] --> Q["quality<br/>typecheck · lint · unit"]
  PR --> I["integration<br/>Postgres service"]
  PR --> E["e2e<br/>build + Playwright"]
  PR --> B["build<br/>next build"]
  M["push to main"] --> D["Vercel deploy"]
  D --> V["verify<br/>/api/health + schema probe"]
  W["workflow_dispatch<br/>migrate"] --> V
```

Rules:

- Every job must pass before merge. `main` is protected.
- The `build` job is **not** redundant with Vercel's build: it fails on a PR,
  where a broken build costs nothing, instead of on `main`, where it costs a
  production deployment.
- Migrations are a **separate, approving job** — never part of every PR run.

---

## 4. `.github/workflows/ci.yml`

```yaml
name: CI

on:
  pull_request:
  push:
    branches: [main]

# A superseded run must not keep burning minutes.
concurrency:
  group: ci-${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

permissions:
  contents: read

jobs:
  quality:
    name: typecheck · lint · unit
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: 1.3.x
      - name: Cache bun
        uses: actions/cache@v4
        with:
          path: ~/.bun/install/cache
          key: bun-${{ runner.os }}-${{ hashFiles('bun.lock') }}
      - run: bun install --frozen-lockfile
      - run: bun run typecheck
      - run: bun run lint
      - run: bun run test

  integration:
    name: tenant isolation
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: kairos
          POSTGRES_PASSWORD: kairos
          POSTGRES_DB: kairos
        ports: ["5432:5432"]
        options: >-
          --health-cmd pg_isready --health-interval 10s
          --health-timeout 5s --health-retries 5
    env:
      DATABASE_URL: postgresql://kairos:kairos@localhost:5432/kairos
      DIRECT_URL: postgresql://kairos:kairos@localhost:5432/kairos
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with: { bun-version: 1.3.x }
      - run: bun install --frozen-lockfile
      - run: bunx prisma migrate deploy
      - run: bun run test:integration

  e2e:
    name: playwright
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: kairos
          POSTGRES_PASSWORD: kairos
          POSTGRES_DB: kairos_e2e
        ports: ["5432:5432"]
        options: >-
          --health-cmd pg_isready --health-interval 10s
          --health-timeout 5s --health-retries 5
    env:
      E2E_DATABASE_URL: postgresql://kairos:kairos@localhost:5432/kairos_e2e
      NEXT_PUBLIC_APP_URL: http://127.0.0.1:3211
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with: { bun-version: 1.3.x }
      - run: bun install --frozen-lockfile
      - name: Cache Playwright browsers
        uses: actions/cache@v4
        with:
          path: ~/.cache/ms-playwright
          key: pw-${{ runner.os }}-${{ hashFiles('bun.lock') }}
      - run: bunx playwright install --with-deps chromium
      - run: bun run test:e2e
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: |
            playwright-report/
            test-results/
          retention-days: 7

  build:
    name: production build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with: { bun-version: 1.3.x }
      - run: bun install --frozen-lockfile
      - name: Build
        run: bun run build
        env:
          # Build-time only. Fake values are enough: the build inlines them and
          # never connects. Real ones must NOT be available to PRs from forks.
          NEXT_PUBLIC_SUPABASE_URL: https://example.supabase.co
          NEXT_PUBLIC_SUPABASE_ANON_KEY: build-only-placeholder
          NEXT_PUBLIC_APP_URL: https://example.com
          NEXT_PUBLIC_VAPID_PUBLIC_KEY: build-only-placeholder
```

Notes that avoid known failures:

- `bun install --frozen-lockfile` (the repo commits `bun.lock`).
- E2E runs on Chromium only — that is already the only Playwright project.
- `NEXT_PUBLIC_SUPABASE_URL` must be *shaped* like a URL, because
  `next.config.ts` compiles the CSP from it; a garbage value still builds, an
  absent one only logs a warning.
- The e2e job never sees a real secret. That is deliberate: PRs from forks can
  run it.

---

## 5. The migration gap

This is the part that must exist. Three options, honestly compared:

| Option | How | Pros | Cons |
| --- | --- | --- | --- |
| **A. Vercel build step** | Build command becomes `prisma migrate deploy && next build`, using `DIRECT_URL` | Cannot forget; every deploy is consistent | Migrations run during **preview** builds too — a branch could alter the production schema. Wrong unless previews use a separate database |
| **B. GitHub Action after deploy** (recommended) | `workflow_run` on the Vercel deploy, or a `migrate` job in `main` | Runs once, on `main`, with an approval gate; can verify the schema afterwards | Migrations and code are not atomic: the new code may be live for seconds before the schema catches up |
| **C. Manual with a checklist** | today | full control | has failed three times |

Recommended: **B**, with the deploy order inverted where it matters — apply
migrations *before* Vercel promotes, or make each migration additive so the gap
is harmless (all seven so far are additive).

```yaml
# .github/workflows/migrate.yml
name: Migrate production

on:
  workflow_dispatch:
    inputs:
      confirm:
        description: 'Type "migrate" to apply pending migrations to production'
        required: true
  workflow_run:
    workflows: [CI]
    types: [completed]
    branches: [main]

jobs:
  migrate:
    if: >-
      github.event_name == 'workflow_dispatch'
        ? github.event.inputs.confirm == 'migrate'
        : github.event.workflow_run.conclusion == 'success'
    runs-on: ubuntu-latest
    environment: production          # requires a manual approval rule
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with: { bun-version: 1.3.x }
      - run: bun install --frozen-lockfile
      - name: Apply pending migrations
        env:
          DIRECT_URL: ${{ secrets.PRODUCTION_DIRECT_URL }}
        run: bunx prisma migrate deploy
      - name: Verify the schema the app actually reads
        env:
          DIRECT_URL: ${{ secrets.PRODUCTION_DIRECT_URL }}
        run: bun run scripts/verify-prod-schema.ts
```

`scripts/verify-prod-schema.ts` is the throwaway probe from the 2026-10-18
incident, promoted to a committed script: `information_schema.columns` for
`Settings`, `Task`, `Habit`, `PushSubscription` plus `_prisma_migrations`. It
prints names only — never URLs.

**Secrets:** `PRODUCTION_DIRECT_URL` belongs to the `production` **Environment**,
not to repository secrets. That gives an approval gate and an audit trail, and
keeps forks away from it.

---

## 6. Hardening the pipeline itself

From the [OWASP Secrets Management cheat sheet §3](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html):

- `permissions: contents: read` at workflow level; no `write` unless a job needs it.
- Never `pull_request_target` — it runs fork code with repository secrets.
- Pin third-party actions by SHA once the set is stable
  (`actions/checkout`, `setup-bun`, `cache`, `upload-artifact` today).
- Do not echo env: `prisma migrate deploy` is safe, `env` is not.
- Add a `gitleaks` job (`gitleaks/gitleaks-action`) over the diff — it is the
  only control that catches the *next* leaked key.
- Keep PR builds secret-free: build placeholders above are enough because
  nothing at build time connects to a database or to Supabase.

Optional, once there is a reason: a `docker build` job. It cannot run on this
machine (no Docker daemon) but Actions has one, and it would catch Dockerfile
regressions that a `next build` never sees.

---

## 7. Verification

**CI itself**

- [ ] Open a PR that breaks `tsc` → `quality` fails, merge is blocked
- [ ] PR that drops a column from `prisma/schema.prisma` → `integration` fails
      (the isolation suite inserts through Prisma)
- [ ] PR that breaks a label the e2e spec asserts → `e2e` fails and uploads a report
- [ ] PR from a fork → no secret is available, `build` still green

**Migrations**

- [ ] `migrate` workflow without the confirmation input → does not run
- [ ] On a database one migration behind → applies exactly one, `verify` prints OK
- [ ] `curl /api/health` after the run → `{"ok":true,"database":"ok"}`
- [ ] Deliberately skip a migration in a scratch database → the verify step fails
      **before** anyone curls the site (this is the incident this prevents)

---

## 8. Rollout order

1. `ci.yml` without e2e (fast feedback in a day).
2. Add `integration` (needs the Postgres service block).
3. Add `e2e` + report artifacts.
4. Add `scripts/verify-prod-schema.ts` and run it manually once.
5. Turn on the `migrate` workflow with a required reviewer.
6. Branch protection: require all four jobs, linear history optional.

Cost estimate: four ubuntu jobs, ~6–9 minutes total per push, well inside the
free minutes for a solo project — the e2e job dominates because of the browser
download (cached after the first run).

---

## 9. Open questions

1. Is the repository public? If so, e2e on PRs must stay secret-free and
   `migrate` must be `workflow_dispatch`-only (no `workflow_run`), because a
   merged-but-unreviewed PR would otherwise migrate production.
2. Should preview deployments get their own database (branching)? That is the
   prerequisite for option A, and also fixes the "preview hits production data"
   class of bug.
3. Do you want the schema probe to be part of `/api/health` instead of a separate
   script? (See [`security-environment.md`](security-environment.md) P1.3.)
