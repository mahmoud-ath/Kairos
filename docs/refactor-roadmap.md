# Refactor and hardening roadmap

A phased plan for the work commissioned on 2026-10-19: split large modules (A),
give event metadata a defined shape (B), carry request information in one context
(D), use interfaces where substitution pays (E), plus environment protection,
rate limiting, CI/CD and feature boundaries.

Every phase is **independently shippable**: it ends with green checks, a commit,
and no half-migrated state. Phases are ordered by *risk removed per hour*, not by
the order the topics were listed.

---

## Status at a glance

| # | Phase | Why here | Status |
| --- | --- | --- | --- |
| 0 | Fixes that unblock trust in the tooling | — | ✅ 2026-10-19 |
| 1 | CI pipeline (the safety net) | Every later phase is a refactor; without CI they are unprotected | ✅ 2026-10-19 |
| 2 | A — split `services/tasks.ts` behind one entrance | Largest file, touched by every feature | ✅ 2026-10-19 |
| 3 | D — request context | Removes repeated `userId`/`today` plumbing; depends on 2 | ✅ 2026-10-19 |
| 4 | B — typed event payloads, completed | Readers and habit writers done in 0; remaining writers | ✅ 2026-10-19 |
| 5 | E — ports where substitution pays | Needs 2 and 3 to be worth doing | ✅ 2026-10-19 |
| 6 | Environment protection (security P0) | Needs CI (1) to enforce it | 🟡 auth guard shipped |
| 7 | Shared rate limiting | Needs CI (1) and the request context (3) | 🟡 steps 1–2 shipped (store provisioning open) |
| 8 | Feature boundaries | Last: it is the shape the rest produce | ⏳ |

Reference documents: [`architecture-review.md`](architecture-review.md) (findings
A1–A9), [`security-environment.md`](security-environment.md),
[`rate-limiting.md`](rate-limiting.md), [`ci-cd.md`](ci-cd.md).

---

## Phase 0 — done 2026-10-19

Four changes, each small enough to review in one sitting.

| Change | Finding | Commit content |
| --- | --- | --- |
| Restored the working shortcut table; added guards that reject tokens the keyboard handler cannot emit and sequences that prefix another | shipped a help dialog that lied, 2 red tests | `src/lib/shortcuts.ts`, `tests/unit/shortcuts.test.ts` |
| `ServiceError` moved to `src/server/errors.ts`; every feature imports it directly | A5 | `server/errors.ts` + 8 import sites |
| Tenancy list moved to `src/lib/tenancy.ts`, derived from `prisma/schema.prisma` by a unit test (both directions) | A3 | `lib/tenancy.ts`, `server/db.ts`, `tests/unit/tenancy.test.ts` |
| `lib/events.ts`: one parser for `TaskEvent.metadata`, tolerant of the legacy `date` field, preserving unknown fields | A2 / B | `lib/events.ts`, `lib/habits.ts`, `lib/stats.ts`, `server/services/{events,tasks}.ts`, `tests/unit/events.test.ts` |

Acceptance met: `typecheck` + `lint` clean, **255 unit tests** (was 238).

---

## Phase 1 — CI pipeline

**Goal.** Every later phase lands on a pipeline that refuses to merge broken work.

**Scope.** `.github/workflows/ci.yml` exactly as specified in
[`ci-cd.md`](ci-cd.md) §4: `quality` (typecheck, lint, unit), `integration`
(Postgres service), `e2e` (build + Chromium), `build`. Branch protection requires
all four.

**Deliberately not in this phase:** the `migrate` workflow. That needs an
environment approval rule and a decision about preview databases — its own phase.

**Acceptance.**

- a PR that breaks `tsc` cannot merge;
- a PR that removes a column from `schema.prisma` fails `integration`;
- a PR from a fork gets no secrets and still builds.

**Rollback.** Delete the workflow files; nothing in the app changes.

**Shipped 2026-10-19** as `.github/workflows/ci.yml` (jobs: `quality`,
`integration`, `e2e`, `build`). Verified locally by running each job's commands
by hand: unit 255, integration 25 against a throw-away database,
`bun install --frozen-lockfile` and the YAML structure. The `e2e` and `build`
jobs were **not** executed on this machine — a `next dev` server holds `.next`,
and building under it is the documented way to corrupt the running app. They will
be proven by the first pull request that runs the workflow.

**The first real run found four things, all fixed in `ac45119`, `d2133df` and
`1708b9e`:**

| Job | Failure | Cause |
| --- | --- | --- |
| `quality` | 5 unit tests | they pinned `Africa/Casablanca`'s real DST rules; the runner's tz database predates the 2018 change. Now fixed-offset zones, with the Morocco block skipped when the runner cannot represent it |
| `integration` | "unparseable DATABASE_URL" | `bun run test:integration` is `env -u DATABASE_URL …` (it protects developer shells); in CI those variables are the only source, so the step stripped its own config |
| `e2e` | 2 stale assertions | the empty state says "Load example data" and the backup format is version 3 — nobody had run the specs since both changed |
| `e2e` | scroll test | it asserted the columns keep their starting y, which is only true while the document still has room to scroll |

That is the pipeline paying for itself on day one. **It also caught that Phase 2
was not in effect**: the split `services/tasks.ts` → `services/tasks/` left the
original 772-line file on disk as an untracked twin, and module resolution prefers
`tasks.ts` over `tasks/index.ts`, so every build still ran the monolith. Deleted;
typecheck, 286 unit, 25 integration and 12/12 e2e now pass against the split.

---

## Phase 2 — A: split `services/tasks.ts` behind one public entrance

**Goal.** 777 lines with six responsibilities become four modules, and callers
keep importing from `@/server/services/tasks`.

**Why it is first among the code refactors.** Every other feature already imports
this module (`habits`, `statistics`, `examples`, `backup`, every action). While it
stays one file, each of them is coupled to all of it.

**Shape.**

```
src/server/services/tasks/
  index.ts    public entrance: re-exports the same names as today
  query.ts    listTasks, listTaskSummaries, loadTaskLinks
  write.ts    createTask, updateTask, deleteTask, restoreTask
  status.ts   setTaskStatus, clearCompletedTasks
  tree.ts     moveTask, reorderTask, nesting/order rules glue
  events.ts   the habit-aware event writes, shared by the above
```

**Rules for this phase.**

1. **Move, do not rewrite.** Function bodies are copied verbatim; only imports
   change.
2. `index.ts` re-exports every name the current module exports, so **no call
   site changes**. That is what makes the phase reviewable as a diff of moves.
3. `ScopedTx` helpers stay internal (`export` only where a module genuinely needs
   them).

**Acceptance.**

- `git diff --stat` shows added/moved files, no behavioural edits;
- `typecheck`, `lint`, 255 unit tests, 25 integration tests pass;
- every existing import path still resolves;
- largest file in `services/tasks/` < 300 lines.

**Rollback.** Revert one commit; no schema, no API, no UI change.

**Shipped 2026-10-19** as `services/tasks/{index,query,write,edit,status,tree,shared}.ts`.
Largest file is now **189 lines** (was 777). The diff touches no importer — that
is the proof the entrance held. `write.ts` was split once more during the phase
(create/restore vs edit/delete) to keep every module under 200 lines.
Verified: `typecheck`, `lint`, **255 unit**, **25 integration** (run against a
throw-away database, exactly as the CI job does).

---

## Phase 3 — D: one request context

**Goal.** Stop re-deriving the tenant and "today" in every layer.

```ts
export type RequestContext = {
  readonly userId: UserId;       // branded; cannot be passed where a category id belongs
  readonly email: string | null;
  readonly settings: SettingsRecord;
  readonly today: string;        // date-only in the account's timezone
};
```

**Scope.**

- `src/server/context.ts` — `createRequestContext()` built from
  `requireAuthProfile()` + `getSettingsRecord()`; **per request**, never cached
  in a module (Vercel reuses instances across users).
- Services accept `ctx` instead of `(userId, …)` in the paths that need settings
  or dates: tasks, habits, statistics. Pure `lib/` functions are unchanged.
- `UserId` brand lives in `src/lib/ids.ts` (or `types/`), with a single
  `asUserId()` cast at the auth boundary.

**Why not a global.** Two accounts can be served by one process; a module-level
"current user" would be a cross-tenant data leak. The context is created once per
request and passed explicitly.

**Acceptance.**

- no service derives `today` itself; ✅ — `ensureHabitInstances`, `getHabitBoard`,
  `createHabit`, `updateHabit`, `setHabitDay` and `getStatistics` take the context
- no `string` userId reaches a tenant query (type-level); **partly** — the id is
  branded at the context boundary (`asUserId`, which refuses an empty value), but
  `scopedPrisma` and the task services still accept a plain `string`. Finishing
  that is a mechanical change across every service signature and belongs with
  Phase 8, when those call sites move to the context anyway
- integration suite unchanged and green (it proves isolation, which is exactly
  what this refactor could break); ✅ 25/25

**Rollback.** Revert; the context is additive until the last commit of the phase.

**Shipped 2026-10-19.** `lib/request-context.ts` (pure shape + derivation),
`lib/ids.ts` (`UserId` brand), `server/context.ts` (`cache()`d per request). The
settings page now *reuses* the layout's read instead of fetching the row again,
and the habit actions lost their `currentDay()` helper. The layout, the workspace
page, the habits page, the statistics page and the habit actions all obtain the
clock the same way. **260 unit tests** (+5 on the derivation, including the
Casablanca midnight boundary).

`/api/backup` deliberately still uses `requireUserId()` + `getSettingsRecord()`:
it is a route handler outside a page render, so there is no layout read to reuse.

---

## Phase 4 — B: finish the typed event payloads

Phase 0 made the **readers** agree. This phase removes the remaining
`Record<string, unknown>` writes.

**Scope.** A discriminated union keyed by action:

```ts
type EventDetails =
  | { action: "created"; parentId: string | null }
  | { action: "completed" | "reopened"; habit?: HabitDayMetadata }
  | { action: "subtask_completed" | "subtask_reopened"; count: number; via: "parent" }
  | { action: "updated"; fields: string[] }
  | { action: "moved"; from: string | null; to: string | null };
```

`recordTaskEvent(ctx, details)` gains the action in the details object, so a
payload that does not match its action becomes a compile error.

**Do not silently discard history** (explicit requirement): the parser keeps
`extra`, already tested with legacy `date`. If a rename is ever needed, aliases go
in `lib/events.ts` first, then the writer changes.

**Acceptance.**

- no `metadata: Record<string, unknown>` remains; ✅
- a deliberate mismatch (e.g. `{ action: "completed", count: 2 }`) fails
  `typecheck`; ✅ — `count` is only accepted by the cascade actions
- habit history, statistics activity and the export/import round-trip are
  unchanged on the e2e suite.

**Shipped 2026-10-19.** `recordTaskEvent(db, details)` now takes a
`TaskEventDetails` union discriminated by `action`; `metadataFromDetails()`
flattens it to exactly the JSON that was written before (`habitDay` expands to
`habitId`/`habitDate`), so stored history and old rows are untouched. Seventeen
call sites were updated, and `habitCompletionMetadata()` returns `undefined`
instead of `{}` so an ordinary task can no longer masquerade as a habit day.
**272 unit tests** (+5 on the writer → reader round trip).

---

## Phase 5 — E: interfaces where substitution pays

**Goal.** Replaceability only where a second implementation actually exists.

Already there: `broadcastDailyReminder({ sender })`. This phase names the type
(`export type PushSender`) and tests retry/duplicate handling with a fake that
records "attempted" — no phone, no push service.

**Not in scope:** a repository wrapper around every Prisma call. It forwards
calls, adds a layer to maintain, and provides no substitution that tests need —
the integration suite already runs against a real Postgres.

**Acceptance.** One fake sender test proving: a transient failure releases the
claim; a 410 removes the device; two runs in one day send once.

**Shipped 2026-10-19.** `PushSender` is now a named, exported port, and the
acceptance cases already existed in `tests/integration/push.test.ts` —
"reminds each device once per local day", "drops a device the push service reports
as gone", "keeps the device and the day when delivery fails transiently" (25/25
green). No new abstraction was added: wrapping Prisma would only forward calls.

---

## Phase 6 — Environment protection

From [`security-environment.md`](security-environment.md), P0 then P1:

1. `KAIROS_AUTH_DISABLED` stops being honoured on a deployment
   (`VERCEL_ENV === "production"`), so a typo cannot make the app a shared
   workspace. **This is the single highest-value change in the whole roadmap.**
2. A `scripts/with-prod-env.sh` guard, and removal of `.env.production.local`.
3. `gitleaks` in CI (needs Phase 1).
4. Separate database roles: `DATABASE_URL` gets DML only, migrations keep the
   owner role.

**Acceptance.** `/today` with no session still 307s on a gated build; with
`KAIROS_AUTH_DISABLED=true` forced in a production-like environment, it **does
not** serve the shared workspace.

**Partially shipped 2026-10-19 — item 1, the highest-value change in the list.**
`isUnauthenticatedModeEnabled()` in `lib/auth-rules.ts` refuses the switch on any
hosted deployment (`VERCEL=1`, or `VERCEL_ENV` of `production`/`preview`), and both
the middleware and `server/auth.ts` go through it, so the edge and node guards
cannot disagree. Preview counts as hosted because its URL is public too. Local
`next dev`/`next start` (and therefore the Playwright suite, and the compose stack)
is unchanged. Covered by three unit cases including the forbidden combination.

Still open in this phase: `scripts/with-prod-env.sh`, removing
`.env.production.local`, `gitleaks` in CI, and split database roles.

---

## Phase 7 — Shared rate limiting

From [`rate-limiting.md`](rate-limiting.md). Order inside the phase:

1. `src/lib/rate-limit.ts` (pure policies, unit tested) — no behaviour change.
2. `consume()` with an in-memory **development** fallback; wire it into
   `runAction()` and the two route handlers.
3. Provision Upstash, add the env vars, redeploy.
4. Configure Supabase auth limits.

**Acceptance.** 61st mutation in a minute returns `429`/`Retry-After`; a second
account is unaffected; a Redis outage allows traffic and logs (fail open, by
policy).

**Step 1 shipped 2026-10-19:** `lib/rate-limit.ts` holds the policies, the
action→bucket mapping and one fixed-window rule, all pure and covered by ten unit
cases (including "a blocked caller cannot extend their own window"). No behaviour
change yet — nothing calls it. Step 2 wires `consume()` into `runAction()` and the
two route handlers; step 3 provisions the shared store.

**Step 2 shipped 2026-10-19.** `server/rate-limit.ts` owns the store and the one
call the app makes into it; `runAction()` spends a token before it runs anything,
and `/api/backup` and the cron route answer `429` with `Retry-After`. Two stores
behind one interface: Upstash (plain `fetch`, no client library) when
`UPSTASH_REDIS_REST_URL`/`_TOKEN` are set, in-process memory otherwise — honest for
`next dev`, the compose stack and Playwright, and useless across instances on
Vercel, which is why the fallback logs once instead of pretending. **Fails open**:
an unreachable store allows the request and logs, because a limiter that takes the
product down is worse than the abuse it prevents.

`KAIROS_RATE_LIMIT_DISABLED=true` turns the limiter off for a local run (the
Playwright config sets it: a spec suite makes more requests a minute than any
person), and it is **ignored on a hosted deployment** by the same rule as the auth
switch.

Verified: 5 integration cases (the limit, a second account unaffected, buckets
independent, window expiry, the fail-open policy) and a live check on a built app
— 10 backups allowed, the 11th `429` with `Retry-After: 3600`. Open: step 3
(provision Upstash and set the two variables in Vercel) and step 4 (Supabase auth
limits).

---

## Phase 8 — Feature boundaries

**Goal.** `src/features/<name>/` with a single public door, and three ESLint
rules that make the dependency direction real:

- `lib/**` may not import `server/**`;
- `components/**` may not import `@prisma/client`;
- a feature may only import another feature's `index.ts`.

**Acceptance.** `services/statistics.ts` no longer reaches into task internals;
the rules are enforced in CI; the graph in `architecture-review.md` §1 can be
redrawn with feature boxes.

---

## Definition of done (whole programme)

| Metric | Start (2026-10-19) | Target |
| --- | --- | --- |
| Largest service file | 777 lines | < 300 |
| Hand-maintained security list | 1 (tenancy) | 0 (tested) |
| Untyped cross-feature JSON | 1 (`TaskEvent.metadata`) | 0 |
| Untested critical path | deploy + migrations | CI on every PR |
| Ungated production risk | `KAIROS_AUTH_DISABLED` | env-guarded |
| Abuse control | none | per-account limits |
| Unit tests | 255 | ≥ 280 |

## Working agreement for these phases

- One phase per commit series; each commit ends green.
- No phase changes behaviour except the phase that explicitly says it does
  (environment protection, rate limiting).
- Every phase updates [`architecture-review.md`](architecture-review.md)'s finding
  table, so the document never drifts from the code.
