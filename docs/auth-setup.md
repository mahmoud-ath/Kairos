# Letting people sign up (Supabase Auth)

> **Public model:** anyone can create an account with email or Google, and gets
> their **own private workspace**. This replaces the older private single-user
> gate.
>
> Background: [`multi-user.md`](multi-user.md) (design) · [`deployment.md`](deployment.md)
> (hosting and the database).

---

## Contents

1. [What this gives you](#1-what-this-gives-you)
2. [Create the Supabase project](#2-create-the-supabase-project)
3. [Turn sign-ups on](#3-turn-sign-ups-on)
4. [The email decision (read this)](#4-the-email-decision-read-this)
5. [Enable Google](#5-enable-google)
6. [Site URL and redirects](#6-site-url-and-redirects)
7. [Where to find the two public values](#7-where-to-find-the-two-public-values)
8. [Where to put them in Vercel](#8-where-to-put-them-in-vercel)
9. [Deploy](#9-deploy)
10. [Verify](#10-verify)
11. [How sign-in works in the code](#11-how-sign-in-works-in-the-code)
12. [Managing users](#12-managing-users)
13. [Troubleshooting](#13-troubleshooting)
14. [Before you go properly public](#14-before-you-go-properly-public)

---

## 1. What this gives you

- Anyone can **create an account at `/register`** and **sign in at `/login`** — with
  an email address or a Google account. Google works on both pages: Supabase
  treats the first use as a sign-up and every later use as a sign-in.
- Each account gets its own tasks, categories and settings. Nobody can see or
  touch anybody else's — enforced in the query layer, with a test suite that
  proves it (`bun run test:integration`).
- Signed-out visitors are sent to `/login` with a `?next=` so they land back where
  they were. `/api/health` and `/auth/callback` stay reachable, because uptime
  checks and the OAuth return trip happen before a session exists.

**Supabase is only the login provider.** Your data lives on Prisma Postgres, and
Supabase never sees it.

---

## 2. Create the Supabase project

<https://supabase.com> → **New project**. Name it `kairos-auth` or similar. The
region matters little — only sign-in traffic touches it. The free tier covers
50,000 monthly active users.

---

## 3. Turn sign-ups on

**Authentication → Sign In / Providers → User Signups**

| Setting | Value for a public app |
| --- | --- |
| **Allow new users to sign up** | **ON** — this is the whole point |
| Allow manual linking | off |
| Allow anonymous sign-ins | off (Kairos needs an identity to own rows) |

> With sign-ups **off**, the only accounts that exist are the ones you create by
> hand. That is the old private-gate model, and it is **not** what you want here.

---

## 4. The email decision (read this)

**Confirm email** decides whether a new account must click a link before it can
sign in.

| | Confirm email **ON** | Confirm email **OFF** |
| --- | --- | --- |
| Spam accounts | much harder | easy |
| New user experience | must find the email first | usable instantly |
| Requirement | **working email delivery** | none |

⚠️ **Supabase's built-in email service is rate-limited to a handful of messages
per hour.** It is meant for testing. With public sign-ups it means most new users
never receive their confirmation link — they will assume your app is broken.

So pick one:

1. **Keep confirmation on and add your own SMTP** — Supabase → **Authentication →
   Emails → SMTP Settings**. [Resend](https://resend.com) has a free tier that
   covers a small app comfortably. Then set **Sender email** to an address on a
   domain you own (a Gmail address will not work as a sender).
2. **Turn confirmation off to start**, and switch it on once SMTP is configured.

For a first launch, option 2 with a plan to move to option 1 is a reasonable
trade.

---

## 5. Enable Google

Enabling the provider in Supabase is only half of it — Google also has to know
about your Supabase project.

**In Google Cloud** (<https://console.cloud.google.com>):

1. Create (or pick) a project → **APIs & Services → OAuth consent screen** →
   **External** → fill in the app name and your support email.
2. **Credentials → Create credentials → OAuth client ID → Web application**.
3. **Authorised JavaScript origins** — add your deployment:
   ```
   https://kairos-zeta-ivory.vercel.app
   ```
4. **Authorised redirect URIs** — add exactly this, with *your* project ref:
   ```
   https://<project-ref>.supabase.co/auth/v1/callback
   ```
   The ref is the subdomain of your Supabase Project URL.
5. Create it, then copy the **Client ID** and **Client secret**.

**In Supabase**: **Authentication → Sign In / Providers → Google** → enable →
paste the Client ID and Client secret → **Save**.

> A wrong redirect URI here is the usual cause of `redirect_uri_mismatch`. It must
> be the **Supabase** callback above, not your Vercel URL — Supabase bounces the
> browser back to your app afterwards.

---

## 6. Site URL and redirects

**Authentication → URL Configuration**. This is what stops Google from dropping
people on `localhost`.

| Field | Value |
| --- | --- |
| **Site URL** | `https://kairos-zeta-ivory.vercel.app` |
| **Redirect URLs** | `https://kairos-zeta-ivory.vercel.app/**` |
| | `http://localhost:3000/**` *(only if you test locally)* |

The `/**` wildcard matters: the app receives the browser at
`/auth/callback?next=…`, and an exact-match allow-list would reject the query
string.

---

## 7. Where to find the two public values

In the Supabase dashboard:

**Project Settings → API** *(on newer dashboards: **Project Settings → API Keys**,
or the **Connect** button at the top of the project)*.

| What you need | Where | Goes into |
| --- | --- | --- |
| **Project URL** — `https://<ref>.supabase.co` | shown as *Project URL* / *API URL* | `NEXT_PUBLIC_SUPABASE_URL` |
| **anon** key, sometimes labelled **publishable** | *Project API keys* | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| ~~service_role~~ | same page, labelled **secret** | ❌ **never** |

Both values are **public by design** — they ship to the browser, and that is safe:
authorisation is enforced by the auth service, and your data is protected by the
per-user filtering in the app.

> **Never** put the `service_role` / secret key here. It bypasses all security.

---

## 8. Where to put them in Vercel

**Vercel → your project → Settings → Environment Variables.**

**Add two:**

| Key | Value | Environments |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<ref>.supabase.co` | Production, Preview, Development |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | the anon/publishable key | Production, Preview, Development |

**Remove one:**

| Key | Why |
| --- | --- |
| `KAIROS_ALLOWED_EMAILS` | **Delete it.** It is an allow-list; with it set, every account except the addresses listed is signed out and bounced to `/login?error=not_allowed`. That is the opposite of "anyone can join". |

Paste the values **without quotes** — the field stores the literal text.

### For local development

Put the same two values in `.env.local` and restart the dev server. That is the
only way to exercise the real sign-in flow on your own machine, and it is what
makes local behaviour match production.

Without them the app **refuses to serve requests** and tells you what to set.
That is deliberate: with no Supabase project there is no way to tell two visitors
apart, so every account would share one workspace. If you are working on
something unrelated to sign-in, set `KAIROS_AUTH_DISABLED=true` and restart — you
then share a single `local` workspace, exactly like the old single-user Kairos.
The Playwright suite sets that flag for itself.

---

## 9. Deploy

```bash
npx vercel login      # once, if the CLI is not authenticated
npx vercel --prod
```

`NEXT_PUBLIC_*` values are **inlined into the browser bundle when the app is
built**, so they only take effect after a new deployment. A deployment created
before you added them will keep serving an app with the gate switched off.

No CLI? **Deployments → ⋯ → Redeploy** in the dashboard does the same thing.

---

## 10. Verify

Use a **private/incognito window** so you are not already signed in.

1. `https://kairos-zeta-ivory.vercel.app/today` → you land on `/login`.
2. Go to **`/register`**, enter an email and a password → with confirmation on you
   get a **Check your inbox** panel with a link to sign in. Click the emailed
   link, then sign in at `/login`.
3. **Continue with Google** on either page → choose an account → you should arrive
   at `/today`.
4. Create a task, reload, and check it survives.
5. **Sign out** in the sidebar → `/today` is blocked again.
6. `/api/health` still answers without a session:
   ```bash
   curl -s https://kairos-zeta-ivory.vercel.app/api/health
   # {"ok":true,"database":"ok"}
   ```
7. **Sign up as a second, different account** and confirm you see an empty
   workspace — not the first account's tasks. This is the isolation guarantee; if
   it ever fails, stop and investigate.

---

## 11. How sign-in works in the code

| File | Role |
| --- | --- |
| `src/app/register/page.tsx` | the create-account page |
| `src/app/login/page.tsx` | the sign-in page |
| `src/components/auth/auth-form.tsx` | the shared email/password form, the Google button, and the "check your inbox" state |
| `src/components/auth/auth-shell.tsx` | the frame both pages share |
| `src/app/auth/callback/route.ts` | exchanges the OAuth or email `code` for a session |
| `src/middleware.ts` | refreshes the session and redirects signed-out visitors to `/login` |
| `src/server/auth.ts` | `requireUserId()` — the only place the current owner is established |
| `src/lib/supabase/server.ts` · `client.ts` | Supabase clients for the server and the browser |
| `src/server/db.ts` | `scopedPrisma(userId)` — makes every query belong to one user |

`/register` is listed in `sitemap.xml` and is indexable; `/login` is marked
`noindex`, since there is nothing for a search engine to gain from it.

The gate is **on by default and fails closed**. It only switches off when
`KAIROS_AUTH_DISABLED=true`, which exists for local development and the Playwright
suite. If `NEXT_PUBLIC_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_ANON_KEY` is
missing, the app returns an error instead of serving anything — a misconfigured
deployment is visibly broken rather than silently public.

---

## 12. Managing users

| Task | Where |
| --- | --- |
| See who has signed up | Supabase → **Authentication → Users** |
| Suspend or remove someone | delete the user in Supabase → **they can no longer sign in** |
| Change someone's password | Auth → Users → the user → **Reset password** |
| Force sign-out everywhere | Auth → Users → **Sign out** for that user |

> **Deleting a Supabase user does not delete their tasks.** The rows are keyed by
> the Supabase user id and nothing cascades across services. Recreate the same
> account and the old data reappears — useful as an undo, but it means removal
> needs a separate data cleanup. See §14.

---

## 13. Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| `/login` never appears; the app is still open | the deployment predates the variables, or they are not on this environment | confirm §8, then **redeploy** |
| Every new user bounces to `/login?error=not_allowed` | `KAIROS_ALLOWED_EMAILS` is still set | delete it (§8) and redeploy |
| `redirect_uri_mismatch` from Google | the redirect URI is not the Supabase callback | fix §5 step 4 |
| Google sign-in returns, then bounces to `/login` | Redirect URLs do not include `…/**` | fix §6 |
| Nobody receives a confirmation email | built-in SMTP rate limit | add your own SMTP or turn confirmation off (§4) |
| `Invalid login credentials` | wrong password, or the account was never confirmed | reset the password, or resend the confirmation |
| Console: CSP blocks `https://<ref>.supabase.co` | the app was built before the variables existed | redeploy — the CSP reads the same variable |
| Sign-in works but the app 500s | the database is missing the multi-user migration | [`deployment.md`](deployment.md) §7 |
| Locked out while fixing something | — | set `KAIROS_AUTH_DISABLED=true` in Vercel, redeploy, fix, then remove it |

---

## 14. Before you go properly public

The app is functional and isolated, but a few things a public service needs are
not built yet:

- **Account deletion.** A user cannot delete their account, and deleting them in
  Supabase leaves their tasks behind (§12). Either build a "delete my data" flow
  or accept keeping a manual process.
- **Rate limiting** on sign-up, so the endpoint cannot be scripted.
- **A privacy policy and terms**, since you are collecting email addresses.
- **Cost awareness.** Supabase Auth is generous, but **Prisma Postgres bills per
  operation** — every page load is several queries — and Vercel's free Hobby plan
  is licensed for non-commercial use only.
