# Rate limiting

Status: **analysis + plan**, 2026-10-18. Not implemented — this is the design the
implementation should follow.

`docs/project-context.md` already lists "Rate limiting: ❌ not built", and
[`multi-user.md`](multi-user.md) has "rate limiting on sign-up" as an open item.
This file replaces both with a concrete plan.

---

## 1. What is actually exposed

Kairos has no REST API to speak of. Nearly every mutation is a **Server Action** —
a `POST` to the page's own URL carrying a `Next-Action` header. That matters,
because a rate limiter bolted onto `/api/*` would protect almost nothing.

| Entry point | Method | Auth | What abuse looks like |
| --- | --- | --- | --- |
| Server Actions (`src/server/actions/*`) | POST, any app route | session | Flooding `createTask`, `loadExampleTasks`, `restoreBackup`, `setHabitDay` — writes and DB load |
| `/api/backup` | GET | session | Repeated full-workspace export: memory + DB + bandwidth |
| `/api/cron/daily-reminder` | GET | shared secret | Already gated; a leaked secret lets someone spam every device |
| `/api/health` | GET | none | Cheap; probing only |
| `/login`, `/register`, `/auth/callback` | POST/GET | none | **Not protected by Kairos at all** — Supabase's own limits apply |

The last row is the important one: **auth is the only fully anonymous write path**,
and it belongs to Supabase. Kairos cannot rate-limit a request it never sees, so
this plan covers what it does see and lists what must be configured in Supabase.

### Verified starting point

- `grep -r "rate.?limit" src/` → no implementation, only prose in comments.
- `runAction()` in `src/server/actions/helpers.ts` is the **single choke point**
  for every action that returns an `ActionResult`. That is where an app-level
  limiter belongs — not scattered across 30 actions.
- The cron route already authenticates; it needs a limit only as defence in depth
  against a leaked secret.

---

## 2. Local vs production: why the obvious implementation fails

| | Local (`bun run dev`) | Production (Vercel) |
| --- | --- | --- |
| Process model | one long-lived Node process | many short-lived serverless instances |
| In-memory counter | survives between requests | **resets per instance, per cold start** |
| Trustworthy client IP | `127.0.0.1` for everyone | first hop of `x-forwarded-for`, set by Vercel |
| Clock | one clock | many clocks, all roughly NTP-synced |

A `Map<string, number>` limiter works perfectly on your laptop and limits nothing
in production: ten parallel requests can land on ten instances, each seeing
"first request". This is the single most common way rate limiting is shipped
broken.

So the design needs a **shared store**, with an in-memory fallback only for
development and tests (where it also makes the tests fast and deterministic).

---

## 3. Options

| Option | Cost | Works on Vercel | Effort | Verdict |
| --- | --- | --- | --- | --- |
| **Vercel WAF rate limiting** | Pro plan | ✅ at the edge, before the app | none (dashboard) | Best first layer *if* on Pro; unavailable on Hobby |
| **Upstash Ratelimit** (`@upstash/ratelimit` + `@upstash/redis`) | free tier: 10k commands/day | ✅ HTTP-based, serverless-friendly | ~1 file + 1 env pair | Recommended app layer |
| Postgres token bucket | free (existing DB) | ✅ but every request costs a write | ~150 lines + migration | Fallback if a second cloud account is unwanted |
| `middleware.ts` in-memory | free | ❌ per-instance | tiny | Dev only |

Upstash is the pragmatic choice because it is connectionless HTTP (no pooling in
serverless), supports sliding windows, and has a documented Next.js integration.
Its SDK also exposes `limit()` results with `remaining`, `reset`, and a
`pending` promise suitable for `after()`.

Research: [Upstash Ratelimit overview](https://upstash.com/docs/redis/sdks/ratelimit-ts/overview)
— caching of blocked identifiers, timeout-with-allow, analytics, multi-region.

---

## 4. Recommended limits

Two layers, two identifiers. **Do not** rate limit by IP alone for signed-in
users: a family behind one NAT would throttle each other, and an attacker with
many IPs would sail through.

| Class | Identifier | Limit | Rationale |
| --- | --- | --- | --- |
| Mutations | `user:<id>` | 60 / minute, 1 000 / hour | A human types ~5 tasks/min at most; batches and drag-reorder bursts still fit |
| Expensive mutations (`loadExampleTasks`, `restoreBackup`, `resetAllData`) | `user:<id>` | 5 / minute, 20 / hour | Each one writes the whole workspace |
| Backup export | `user:<id>` | 10 / hour | Rare, heavy |
| Anonymous fallback (no session) | `ip:<addr>` | 20 / minute | Only the auth pages and `/` are anonymous |
| Cron endpoint | shared | 6 / hour | It is a daily job; anything more is a mistake or a replay |

Status codes: `429` with `Retry-After` (seconds) and a JSON body for route
handlers; for Server Actions, return `{ok:false, error:"Too many requests…"}` —
`ActionResult` already carries that shape to a toast.

---

## 5. Implementation sketch

### 5.1 Pure rules (testable, no I/O)

```ts
// src/lib/rate-limit.ts
export type RateLimitPolicy = { limit: number; windowSeconds: number };

export const RATE_LIMITS = {
  mutation: { limit: 60, windowSeconds: 60 },
  expensive: { limit: 5, windowSeconds: 60 },
  backup: { limit: 10, windowSeconds: 3600 },
  cron: { limit: 6, windowSeconds: 3600 },
} as const satisfies Record<string, RateLimitPolicy>;

/** Seconds until the window resets, for `Retry-After`. Never negative. */
export function retryAfterSeconds(resetAt: number, now: number): number {
  return Math.max(0, Math.ceil((resetAt - now) / 1000));
}

/** Which policy an action name falls under. Pure, so the mapping is unit-tested. */
export function policyForAction(name: string): RateLimitPolicy {
  if (name === "loadExampleTasks" || name === "restoreBackup" || name === "resetAllData") {
    return RATE_LIMITS.expensive;
  }
  return RATE_LIMITS.mutation;
}
```

### 5.2 Adapters

```ts
// src/server/rate-limit.ts
import "server-only";

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

import { RATE_LIMITS, type RateLimitPolicy } from "@/lib/rate-limit";

/**
 * Shared limiter, or a per-process fallback in development.
 *
 * The fallback exists so `bun run dev` and the Playwright suite need no cloud
 * account — and its comment says loudly that it is worthless in production,
 * because a serverless instance cannot remember a counter.
 */
const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    : null;

const limiters = new Map<string, Ratelimit>();

export async function consume(
  bucket: keyof typeof RATE_LIMITS,
  identifier: string,
): Promise<{ allowed: boolean; retryAfter: number }> {
  const policy = RATE_LIMITS[bucket];

  if (!redis) return consumeInMemory(bucket, identifier, policy); // dev only

  let limiter = limiters.get(bucket);
  if (!limiter) {
    limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(policy.limit, `${policy.windowSeconds} s`),
      prefix: `kairos:rl:${bucket}`,
      // A 500 ms Redis outage must not take the app down: allow, and log.
      timeout: 500,
    });
    limiters.set(bucket, limiter);
  }

  const result = await limiter.limit(identifier);
  return { allowed: result.success, retryAfter: Math.ceil((result.reset - Date.now()) / 1000) };
}
```

### 5.3 Wiring it into the one choke point

```ts
// src/server/actions/helpers.ts  (shape only)
export async function runAction<T>(
  name: string,
  fn: () => Promise<T>,
  options: { revalidate?: boolean } = {},
): Promise<ActionResult<T>> {
  const { userId } = await requireAuthProfile();
  const { allowed, retryAfter } = await consume(
    bucketForAction(name),
    `user:${userId}`,
  );
  if (!allowed) {
    return { ok: false, error: `Too many changes — try again in ${retryAfter}s.` };
  }
  // …existing try/catch + revalidate
}
```

This touches every action by changing its call site from
`runAction(fn)` to `runAction("createTask", fn)` — mechanical, and it makes the
action's name part of the limit policy instead of relying on the Next internal
action id.

### 5.4 Route handlers

`/api/backup` and `/api/cron/daily-reminder` get the same `consume()` call and
return `429` with `Retry-After` — a real HTTP status, which the browser and
uptime tools understand.

---

## 6. What Kairos cannot do itself

- **Sign-up and sign-in throttling.** Supabase owns `/auth/v1/*`. Configure
  Supabase Auth rate limits (Dashboard → Authentication → Rate Limits) and,
  for serious abuse, a CAPTCHA (Supabase supports hCaptcha/Turnstile).
- **IP reputation, bot signatures, volumetric attacks.** That is edge firewall
  territory (Vercel WAF, Cloudflare). An app-level limiter sees the request only
  after it has already been parsed.

The honest layering:

```
Cloudflare/Vercel WAF  →  Supabase auth limits  →  Kairos app limiter  →  DB constraints
```

---

## 7. Testing

| Level | Test |
| --- | --- |
| Unit | `policyForAction` mapping; `retryAfterSeconds` clamps at 0; window boundary at exactly N+1 |
| Integration | 61 mutations for one user → 61st refused; a second user is unaffected (the class of bug this exists to prevent); expensive bucket trips at 6 |
| Manual (local) | `for i in $(seq 1 70); do curl … ; done` against a running dev server — in-memory fallback still proves the wiring |
| Manual (prod, staging first) | same loop with a real session cookie; expect `429` + `Retry-After` |

Reset between tests by using a unique identifier (`user:<random uuid>`), exactly
like the existing isolation suite does with tenant ids — never by flushing the
shared Redis.

---

## 8. Rollout

1. Ship `lib/rate-limit.ts` + unit tests (no behaviour change).
2. Add `consume()` with the dev fallback; deploy. Verify the app behaves
   identically (the limiter allows everything at normal volumes).
3. Provision Upstash, add `UPSTASH_REDIS_REST_URL` / `..._TOKEN` to Vercel for
   all three scopes, redeploy.
4. Watch the blocked-count metric for a week before tightening any limit.
5. Configure Supabase auth limits and, on Pro, Vercel WAF rules.

---

## 9. Open questions

1. Is the Vercel project on **Pro**? If yes, a WAF rule can cover the anonymous
   traffic for free and the app limiter only needs to handle per-account
   fairness.
2. Is a second cloud account (Upstash) acceptable, or should the limiter use the
   existing Postgres (one extra write per mutation)?
3. Should the "expensive" bucket be surfaced in the UI (a disabled button with a
   countdown) rather than a toast?
