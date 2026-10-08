# Adding sign-in with Supabase Auth

> ## ⚠️ Superseded — this documents the old **private single-user** model
>
> It describes one person protecting their own task list: sign-ups **off** and an
> email allow-list.
>
> **For a public app where anyone can sign up, use
> [`auth-setup.md`](auth-setup.md) instead.** The settings on this page would
> either lock everyone out (the allow-list) or hand every user the same shared
> data (sign-ups on against a single-tenant database).
>
> Kept only for the case it describes: a private deployment for one person.

**Without this, your deployment is public.** Anyone who knows the URL can read,
change and delete every task. About five minutes to set up.

> **Supabase here is only the login provider.** Your data stays on Prisma
> Postgres. The two services are unrelated — Supabase never sees your tasks.

---

## Contents

1. [What this actually does](#1-what-this-actually-does)
2. [Create the Supabase project](#2-create-the-supabase-project)
3. [Turn on email sign-in and turn off sign-ups](#3-turn-on-email-sign-in-and-turn-off-sign-ups)
4. [Create your user](#4-create-your-user)
5. [Copy the two public values](#5-copy-the-two-public-values)
6. [Set the variables in Vercel](#6-set-the-variables-in-vercel)
7. [Redeploy](#7-redeploy)
8. [Verify](#8-verify)
9. [How the gate works](#9-how-the-gate-works)
10. [Everyday use](#10-everyday-use)
11. [Troubleshooting](#11-troubleshooting)
12. [Turning it off](#12-turning-it-off)

---

## 1. What this actually does

Kairos stores one person's tasks. There is no concept of "my tasks" versus "your
tasks" — the database is a single shared workspace.

So this is an **access gate**, not multi-tenancy. It answers *"may this visitor
touch the workspace?"* It does not give each user their own data.

Concretely, once configured:

- Visiting any app page while signed out redirects to `/login`.
- The only reachable unsigned route is `/api/health` (for uptime checks).
- Signing in with an email that is not on your allowlist drops the session.
- A **Sign out** button appears at the bottom of the sidebar.

---

## 2. Create the Supabase project

1. <https://supabase.com> → sign in → **New project**.
2. Name it something like `kairos-auth`. Pick a region near you (it is only used
   for sign-in, so latency matters little).
3. Save the **database password** it generates — you will not need it, but keep it
   anyway.

The free tier is more than enough: you are using nothing but the auth service.

---

## 3. Turn on email sign-in and turn off sign-ups

1. **Authentication → Sign In / Providers → Email**: make sure it is **enabled**
   and **Confirm email** is on.
2. **Authentication → Sign In / Providers → Email → Allow new users to sign up**:
   turn this **OFF**. You are the only account; leaving it on means anyone who
   finds your Supabase project can register.
3. Optional but recommended: **Authentication → Settings → Email Auth** → leave
   "Secure email change" on.

With sign-ups off, the only way an account appears is if you create it by hand —
which is exactly what you want.

---

## 4. Create your user

**Authentication → Users → Add user → Create new user**

- **Email:** your address
- **Password:** choose one
- ✅ **Auto Confirm User** — tick this, otherwise the account cannot sign in until
  the confirmation email is clicked

Write the password down somewhere safe; that is what you will use at `/login`.

---

## 5. Copy the two public values

Supabase → **Project Settings → API** (on newer dashboards: **API Keys**).

| Value | Goes into |
| --- | --- |
| **Project URL** — `https://<ref>.supabase.co` | `NEXT_PUBLIC_SUPABASE_URL` |
| **anon / public** key | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |

> Both are **public by design** — they ship to the browser. That is fine: row-level
> security and the auth service enforce access. Never use the **service_role**
> key here; it bypasses all security.

---

## 6. Set the variables in Vercel

**Vercel → your project → Settings → Environment Variables.** Add all three for
**Production, Preview and Development**:

| Variable | Value |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | the anon/public key |
| `KAIROS_ALLOWED_EMAILS` | your email address, e.g. `you@example.com` |

`KAIROS_ALLOWED_EMAILS` accepts a comma-separated list. Leaving it empty means
"any account that exists in the Supabase project", which is acceptable but less
defensive — set it.

These are `NEXT_PUBLIC_*` values, so they are **inlined into the browser bundle
when the app is built**. They only take effect after a new deployment.

### Locally (optional)

`bun run dev` does not need auth; the gate stays inert when these are unset. If
you do want to exercise the login flow locally, add the same three variables to
`.env.local` (already git-ignored) and restart the dev server.

---

## 7. Redeploy

```bash
npx vercel --prod
```

This is not optional: the build has to see the new `NEXT_PUBLIC_*` values. A
deployment created before you added them will keep serving an unauthenticated app.

---

## 8. Verify

1. Open `https://<your-project>.vercel.app/today` in a **private/incognito
   window** → you should land on `/login`.
2. Sign in with the email and password from step 4 → you should arrive at `/today`.
3. Reload — you stay signed in.
4. **Sign out** in the sidebar → back to `/login`, and `/today` is blocked again.
5. Try signing in with an address *not* on the allowlist (create a throwaway user
   to test) → you are rejected and bounced to `/login?error=not_allowed`.
6. `/api/health` still answers without signing in:
   ```bash
   curl -s https://<your-project>.vercel.app/api/health
   # {"ok":true,"database":"ok"}
   ```

---

## 9. How the gate works

| File | Role |
| --- | --- |
| `src/lib/supabase/server.ts` | Supabase client for Server Components and actions |
| `src/lib/supabase/client.ts` | browser client, used only by the sign-in form |
| `src/lib/auth-rules.ts` | the allowlist rule (pure, unit-tested) |
| `src/server/auth.ts` | `requireUser()` guard + `isAuthDisabled()` |
| `src/middleware.ts` | refreshes the session, redirects to `/login`, drops non-allowlisted sessions |
| `src/app/login/` | the sign-in page and form |
| `src/server/actions/auth.ts` | sign-out |
| `src/app/(app)/layout.tsx` | calls `requireUser()` before any query runs |
| `src/app/api/backup/route.ts` | returns `401` to an unauthenticated download |

The gate is **inert** when `NEXT_PUBLIC_SUPABASE_URL` is unset. That is what keeps
local development and the Playwright suite working without credentials, and it is
why an unconfigured deployment is public. `KAIROS_AUTH_DISABLED=true` forces the
same state explicitly.

---

## 10. Everyday use

| Task | Where |
| --- | --- |
| Add another person | Supabase → Authentication → Users → **Add user** (then add their email to `KAIROS_ALLOWED_EMAILS`) |
| Remove someone | Supabase → Authentication → Users → delete, **and** remove them from `KAIROS_ALLOWED_EMAILS`, then redeploy |
| Change your password | Supabase → Authentication → Users → your user → **Reset password** |
| See who is signed in | Supabase → Authentication → Users → *Last sign in* |
| Sign out everywhere | Supabase → Authentication → Users → **Sign out** for that user |

> If you later switch to magic links or an OAuth provider, set Supabase →
> Authentication → URL Configuration → **Site URL** to your Vercel domain, and add
> it to **Redirect URLs**. Email + password needs neither, because there is no
> redirect.

---

## 11. Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| Still no `/login` after redeploying | `NEXT_PUBLIC_*` values not inlined, or the deployment predates them | confirm the variables, then **redeploy** |
| `Invalid login credentials` | wrong password, or the user was created without *Auto Confirm User* | reset the password, or recreate the user |
| Sign-in succeeds but you bounce straight back to `/login` | the email is not in `KAIROS_ALLOWED_EMAILS` | add it and redeploy |
| Browser console: CSP blocks `https://<ref>.supabase.co` | the app was built before the variables existed | redeploy so the CSP picks up the Supabase origin |
| Redirected to `/login` even in private mode | expected — that is the gate working | — |
| Locked out entirely | — | set `KAIROS_AUTH_DISABLED=true` in Vercel, redeploy, fix the account, then remove it |

---

## 12. Turning it off

Either **remove** `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
from Vercel, or set `KAIROS_AUTH_DISABLED=true`. Then redeploy.

**Do not leave it off on a public URL.** If you must run without sign-in, at least
set `KAIROS_NO_INDEX=true` so search engines keep away — that hides the app, it
does not protect it.
