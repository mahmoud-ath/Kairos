# Troubleshooting

The failures that cost the most time, and how to identify each one in under a
minute. Ordered by how often they actually happen.

Most Kairos deployment problems are one of three things:

1. **A value points at the wrong place** — a stale project ref, a swapped
   connection string, a key from a different project
2. **A value was set after the build** — and `NEXT_PUBLIC_*` values are baked in
   at build time
3. **You are reading the wrong error** — the browser shows a generic message and
   the real one is in the server logs

For anything else, the per-part tables also live in
[deployment.md §12](deployment.md#12-troubleshooting) and
[auth-setup.md §14](auth-setup.md#14-troubleshooting).

---

## 0. Find the real error first

Next.js hides server-side exceptions behind
`Application error: a server-side exception has occurred` plus a **digest** — a
correlation id, not a message. The actual text is in the runtime logs:

```bash
npx vercel logs https://<your-app>.vercel.app
```

Or: project → **Deployments** → the deployment → **Runtime Logs**. For an
untruncated stack trace use **Functions → Logs**.

**A browser error that never reached your server will not appear in these logs
at all.** If the logs are empty, the request died in the browser — go to §1.

---

## 1. "Failed to fetch" on the sign-in page

You submit the form, or click *Continue with Google*, and get a bare red
**Failed to fetch**. No server logs, because the request never got a response.

That message is the browser's way of saying *"I could not complete this request
at all."* There are exactly three causes, in order of likelihood.

### A. The Supabase hostname does not exist

The most common cause, and the one that is hardest to see — because everything
*looks* configured. A wrong project ref, a deleted project, or a paused free-tier
project all produce a hostname that does not resolve.

```bash
curl -s -o /dev/null -w '%{http_code}\n' \
  "https://<ref>.supabase.co/auth/v1/settings" \
  -H "apikey: <anon-key>"
```

| Result | Meaning |
| --- | --- |
| `200` | host and key are both good — the problem is elsewhere |
| `Could not resolve host` | **the ref is wrong**, or the project was deleted or paused |
| `401` | right host, wrong key |

To be certain, ask a public resolver — this is authoritative and cannot be a
local DNS quirk:

```bash
curl -s "https://dns.google/resolve?name=<ref>.supabase.co&type=A" | head -c 300
```

- `"Status":0` with an `"Answer"` array → the host exists
- `"Status":3` → **NXDOMAIN** → the host does not exist, full stop

> This is not hypothetical: a deployment once failed with "Failed to fetch" in
> both localhost and production for exactly this reason. One dead hostname, two
> apparent symptoms — which is why they must be diagnosed together, not
> separately.

If the project was **paused** (free-tier projects pause after a stretch of
inactivity) the dashboard offers a **Restore project** button. If it was
**deleted**, create a new one — and read §2, because a new project means new
settings *and* a new ref everywhere.

### B. The URL and the key are from different projects

The anon key is a JWT, and its payload names the project it belongs to:

```bash
echo "<anon-key>" | cut -d. -f2 | base64 -d 2>/dev/null; echo
# {"iss":"supabase","ref":"jexeakhohftqqwfjeqkd","role":"anon","iat":…,"exp":…}
```

The `ref` **must** match the subdomain of your `NEXT_PUBLIC_SUPABASE_URL`. A
mismatched pair is invisible in every dashboard and fails on the very first
request.

### C. The Content Security Policy is blocking the origin

`next.config.ts` compiles `connect-src` from `NEXT_PUBLIC_SUPABASE_URL` **at build
time**. If the variable was missing or stale when the app was built, the browser
blocks the request and reports the same opaque "Failed to fetch".

Read what the *running* build actually allows:

```bash
curl -sI https://<your-app>/login | grep -io "connect-src[^;]*"
```

```
connect-src 'self' https://jexeakhohftqqwfjeqkd.supabase.co wss://…
```

If the origin is missing, or shows an old ref, that deployment was built with the
wrong value → fix the variable and **redeploy** (§3).

A build made without `NEXT_PUBLIC_SUPABASE_URL` now prints a warning saying
exactly this, so check the build output too.

---

## 2. Which Supabase project is my build using?

The question you will ask most often, and the CSP header answers it instantly:

```bash
curl -sI https://<your-app>/login | grep -io "connect-src[^;]*"
```

The CSP is compiled from `NEXT_PUBLIC_SUPABASE_URL` at build time, so the origin
in that header **is** the value the deployment was built with. It bypasses every
question about what the dashboard, the CLI or `.env.local` currently say.

The same trick works locally:

```bash
curl -sI http://localhost:3000/login | grep -io "connect-src[^;]*"
```

And to see which providers are enabled on a project (this endpoint is public):

```bash
curl -s "https://<ref>.supabase.co/auth/v1/settings" -H "apikey: <anon-key>" \
  | python3 -c "import json,sys; d=json.load(sys.stdin); \
print({k: v for k, v in (d.get('external') or {}).items() if v}); \
print('signups disabled:', d.get('disable_signup')); \
print('email autoconfirm:', d.get('mailer_autoconfirm'))"
```

---

## 3. "I changed a variable and nothing happened"

Four different reasons, and they feel identical.

| Cause | Check | Fix |
| --- | --- | --- |
| **`NEXT_PUBLIC_*` is inlined at build time** — the value is frozen into the JavaScript bundle | [§2](#2-which-supabase-project-is-my-build-using) shows the old value | deploy again. Not a restart — a **new build** |
| **The variable is not set for this environment** | `npx vercel env ls` | add it to Production **and** Preview **and** Development |
| **An exported shell variable is overriding `.env.local`** | `env \| grep NEXT_PUBLIC` | real environment variables win over `.env` files in Next.js. Unset them: `unset NEXT_PUBLIC_SUPABASE_URL` |
| **You are serving a stale local build** | — | `bun run build` again, then restart |

The third one wastes the most time, because the file on disk is correct and the
process is not. Always test config-dependent behaviour with a scrubbed
environment:

```bash
env -u NEXT_PUBLIC_SUPABASE_URL -u NEXT_PUBLIC_SUPABASE_ANON_KEY bun run dev
```

> Related trap: `next start` loads `.env.production.local`, not `.env`. So a local
> production run uses the **remote** `DATABASE_URL`, and `/api/health` returns
> `503 {"ok":false,"database":"error"}`. That is expected, not a bug — use
> `bun run dev` for local work.

---

## 4. Database connection failures

All of these are in [deployment.md §12](deployment.md#12-troubleshooting) with
full detail. The short version:

| Log message | Real cause |
| --- | --- |
| `Can't reach database server at localhost:5432` | `DATABASE_URL` is still your local development value |
| `Can't reach database server` at `db.prisma.io` (`P1001`) | the URL still contains a placeholder — `USER`, `PASSWORD`, `…`, `<your-user>` |
| ``The table `public.Settings` does not exist`` (`P2021`) | migrations were never applied **to this database** |
| `prepared statement` or lock errors during a migration | the **pooled** string was used for migrations |
| `Too many connections` | app traffic is on the **direct** host |
| `Authentication failed` | wrong password — or quotes/whitespace pasted into the Vercel form |

Two rules:

- **`DATABASE_URL`** → the pooled host (`pooled.db.prisma.io`) — the running app
- **`DIRECT_URL`** → the direct host (`db.prisma.io`) — migrations only

> A placeholder like `<your-user>` *looks* like a connection problem and is not
> one. Real strings contain a 64-character random username and a password
> starting with `sk_`. If you are unsure, use the real file rather than retyping:
> `set -a; . ./.env.production.local; set +a`

---

## 5. Setting variables from the Vercel CLI

The CLI has a trap that silently loses data:

```bash
# ✗ stops at an interactive "this name or value looks like a credential" prompt.
#   If stdin closes, the variable is NOT saved — and if you already removed it,
#   it is now gone.
npx vercel env rm NEXT_PUBLIC_SUPABASE_ANON_KEY production --yes
printf '%s' "$KEY" | npx vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
```

Use the non-interactive form, and set all three environments in one call:

```bash
npx vercel env add NEXT_PUBLIC_SUPABASE_URL production,preview,development \
  --value "https://<ref>.supabase.co" --no-sensitive --force --yes

npx vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production,preview,development \
  --value "<anon-key>" --no-sensitive --force --yes
```

`--no-sensitive` stores it as a **Config** value that stays readable —
correct for `NEXT_PUBLIC_*`, which ships to the browser anyway.

Always verify what actually landed, rather than trusting the command's output:

```bash
for E in production preview development; do
  echo "--- $E ---"
  npx vercel env pull /tmp/check-$E.env --environment=$E --yes >/dev/null 2>&1
  grep -o "NEXT_PUBLIC_SUPABASE_URL=.*" /tmp/check-$E.env
done
```

---

## 6. Recreated your Supabase project? Read this

Settings **do not carry over between projects.** Recreating a project means
re-doing every one of these, in every place the ref appears:

| Where | What to update |
| --- | --- |
| `.env.local` | `NEXT_PUBLIC_SUPABASE_URL` — **and** the key, they must match |
| Vercel | `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| Supabase → Authentication → URL Configuration | Site URL and redirect URLs |
| Supabase → Authentication → Providers | re-enable Google, re-paste the credentials |
| Google Cloud → OAuth client | the redirect URI, which contains the ref |
| Google Cloud → OAuth client | the authorised JavaScript origin |

The ref is in the hostname `https://<ref>.supabase.co`, in the anon key's `ref`
claim, and in Google's callback URL. **Search for the old ref everywhere before
concluding you are done:**

```bash
grep -rn "your-old-ref" .env* next.config.ts docs/ 2>/dev/null
```

---

## 7. Quick reference

```bash
# Is the app up, and can it reach its database?
curl -s https://<your-app>/api/health          # {"ok":true,"database":"ok"}

# Which Supabase project is this build using?
curl -sI https://<your-app>/login | grep -io "connect-src[^;]*"

# Does the project exist, and is the key valid?
curl -s -o /dev/null -w '%{http_code}\n' \
  "https://<ref>.supabase.co/auth/v1/settings" -H "apikey: <anon-key>"

# Authoritative DNS answer for a hostname
curl -s "https://dns.google/resolve?name=<ref>.supabase.co&type=A" | head -c 300

# Which project does this key belong to?
echo "<anon-key>" | cut -d. -f2 | base64 -d 2>/dev/null; echo

# What did this deployment actually build with?
npx vercel env pull /tmp/p.env --environment=production --yes && grep SUPABASE /tmp/p.env

# The real server error behind "Application error … Digest"
npx vercel logs https://<your-app>.vercel.app
```

**Locked out while fixing something?** Set `KAIROS_AUTH_DISABLED=true` in Vercel,
redeploy, fix the problem, then remove it and redeploy. It removes the gate that
keeps each account's data separate, so treat it as a temporary tool — never leave
it on a deployment that is reachable from the internet.
