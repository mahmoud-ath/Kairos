# Multi-user: private workspaces

> **Status:** implemented. This page is the **design rationale**, not a how-to —
> for the walkthrough see [auth-setup.md](auth-setup.md) and
> [deployment.md](deployment.md).
> **Goal:** anyone can sign up (email/password or Google) and gets their own
> private set of tasks, categories and settings — free to use.
>
> This supersedes the original "private single-user gate" model described in
> [`supabase-auth.md`](supabase-auth.md).

---

## 1. The decision

| Question | Answer |
| --- | --- |
| What do two signed-in users see? | **Their own private workspace.** No sharing. |
| Where is isolation enforced? | **In the application layer**, in `src/server/services/**`. |
| Sign-in methods | **Email + password _and_ Google.** |

Signed in as A, you cannot see, edit, delete or infer the existence of B's tasks,
categories, events or settings — not through any page, Server Action or API route.

---

## 2. Why this is not just "turn sign-ups on"

Today the database is **single-user**. There is no `userId` anywhere:

- `Task`, `Category`, `TaskEvent` are one global set of rows.
- `Settings` is a single row (`id = "singleton"`) holding *the* theme, timezone
  and week-start preference.
- `Category.name` is `@unique` **globally**, so two people could not both have a
  category called "Work".

The existing gate (`requireUser()` + `KAIROS_ALLOWED_EMAILS`) only answers *"is
somebody signed in?"*. It never answers *"whose rows are these?"*.

> ⚠️ **Therefore: enabling public sign-ups before this work is finished would
> expose every user's tasks to every other user.** Sign-ups stay **off** until
> Phase 1 is complete and tested.

---

## 3. Schema change

```prisma
model Task {
  // ...
  userId String          // ← new
  @@index([userId, parentId, position])
  @@index([userId, status])
  // ...
}

model Category {
  // ...
  userId String          // ← new
  @@unique([userId, name])   // was: name @unique  (global)
}

model TaskEvent {
  // ...
  userId String          // ← new
}

model Settings {
  userId String @id      // was: id String @id @default("singleton")
  // ...
}
```

Notes:

- **No local `User` table.** Supabase owns identities; we store its user id as a
  plain string. That avoids sync-on-sign-in plumbing and an extra table. The cost
  is no cascade on account deletion — a cleanup job or a Supabase webhook can
  handle that later.
- `Settings` is keyed by `userId`, so theme/timezone/week-start become per-person.
- Every index leads with `userId`, because every query will filter on it.

### Migration

The existing rows belong to nobody. Two options at apply time:

```bash
# Production is empty — the migration simply creates the columns.
bunx prisma migrate deploy

# Local development has throw-away test data.
bun run db:reset
```

If you want to keep a local dataset, assign it to a placeholder id first
(`UPDATE "Task" SET "userId" = '<uuid>' WHERE "userId" IS NULL;`) before the
column is made `NOT NULL`.

---

## 4. How isolation is enforced

### In the service layer, not the database

This is the agreed approach. The database is Prisma Postgres, so Supabase's Row
Level Security is **not available** — RLS only exists inside a Supabase Postgres
project. (Choosing RLS would mean migrating the data to Supabase and reworking how
Prisma connects.)

The good news: this codebase already funnels **all** database access through
`src/server/services/**`. That single choke point is what makes app-layer
enforcement safe rather than hopeful.

### The rules

1. **Every** tenant-model query filters by `userId` — reads, updates, deletes and
   counts alike. A read that forgets the filter is a data leak; a write that
   forgets it is data corruption.
2. **The tenant is never trusted from the client.** `userId` always comes from the
   verified session, never from a request body, query string or form field.
3. **Fail closed.** A missing tenant is an error, not an empty result and not "all
   rows". If the code cannot determine who is asking, it must not answer.
4. **Sub-resources are re-checked.** Fetching a task by id is not enough — the
   fetch is filtered by `userId` too, so another user's id simply returns nothing.
5. **Nested access follows the parent.** Subtasks inherit their parent's owner;
   the parent is verified first.

### Shape of the code

Services gain an explicit owner argument, so the compiler refuses to let a caller
forget it:

```ts
export async function listTasks(userId: string): Promise<TaskDTO[]> {
  const rows = await prisma.task.findMany({
    where: { parentId: null, userId },   // ← always present
    include: TASK_INCLUDE,
    orderBy: TASK_ORDER,
  });
  return rows.map(serializeTask);
}
```

Callers resolve the owner once per request from the session:

```ts
const userId = await requireUserId();   // src/server/auth.ts
```

### Tests that must exist before sign-ups are enabled

- User A creates a task; user B's `listTasks()` does not contain it.
- B cannot `getTask(A.id)` — it returns `null`, not A's row.
- B cannot update, complete, delete or reorder A's task.
- B cannot attach a task to A's category, or read A's categories.
- Both users can each create a category called "Work" (per-user uniqueness).
- Settings are independent: changing B's theme does not touch A's.
- Backup export returns only the caller's rows.

---

## 5. Plan

| Phase | Work | Status |
| --- | --- | --- |
| **1** | **Data isolation.** Schema, migration, `userId` through every service, action and page, per-user settings, scoped backup, isolation tests. | ⬜ next |
| **2** | **Register/login UI.** Sign-up + sign-in, validation, loading and error states, "Continue with Google", signed-in landing. | ⬜ |
| **3** | **Supabase + Google + Vercel configuration** (§6). | ⬜ |
| **4** | **Rewrite the deployment and auth docs** for the multi-user model. | ⬜ |

Phase 1 must be a **single pass**: adding `userId` to the schema without updating
the services leaves the project unable to compile.

---

## 6. Corrected setup steps (multi-user)

These replace the five steps for the old private-gate model.

### 6.1 Supabase project

1. <https://supabase.com> → **New project**.
2. **Authentication → Sign In / Providers → Email**: enabled, **Confirm email** on.
3. **Allow new users to sign up: ON** ← the opposite of the private model.
4. **Do not set `KAIROS_ALLOWED_EMAILS`.** For a public app an allowlist would
   lock everyone out.

### 6.2 Google sign-in

1. <https://console.cloud.google.com> → new project → **APIs & Services →
   OAuth consent screen** → External → fill in the app name and support email.
2. **Credentials → Create credentials → OAuth client ID → Web application**.
3. **Authorised redirect URI** (exactly this, with your project ref):
   ```
   https://<project-ref>.supabase.co/auth/v1/callback
   ```
4. Copy the **Client ID** and **Client secret** into Supabase →
   **Authentication → Providers → Google** → enable → paste → Save.
5. Back in Google, add your production origin under **Authorised JavaScript
   origins**: `https://<your-project>.vercel.app`.

### 6.3 Supabase URL configuration

**Authentication → URL Configuration** (this is what makes Google redirect home
correctly — email/password alone does not need it):

- **Site URL:** `https://<your-project>.vercel.app`
- **Redirect URLs:** add `https://<your-project>.vercel.app/**` and, for local
  work, `http://localhost:3000/**`

A mismatch here is the classic cause of "sign in with Google worked, then bounced
me to localhost".

### 6.4 Email delivery

Supabase's built-in email service is fine for testing but is **rate-limited to a
handful of messages per hour**. With public sign-ups that means most new users
never receive their confirmation email.

Pick one:

- **Custom SMTP** — Supabase → Authentication → Emails → SMTP settings. Resend's
  free tier covers a small app.
- **Confirmation off** — Authentication → Sign In / Providers → Email →
  *Confirm email* **off**. Nobody is blocked, at the cost of unverified addresses.
  Reasonable to start; turn it back on once SMTP is configured.

### 6.5 Vercel

| Variable | Change |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | add |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | add |
| `NEXT_PUBLIC_APP_URL` | already set |
| `KAIROS_ALLOWED_EMAILS` | **remove** (or leave empty) |

Then redeploy — `NEXT_PUBLIC_*` values are inlined at build time.

---

## 7. Before you open sign-ups: a reality check

**Cost.** "Free for users" is a product decision; the infrastructure still costs
something.

| Service | Free tier | When it starts to bite |
| --- | --- | --- |
| Supabase Auth | 50,000 monthly active users | plenty for a long time |
| Prisma Postgres | billed **per operation**, not per hour | every page load runs several queries — the first real cost with many active users |
| Vercel Hobby | non-commercial use only | a commercial app needs Pro |
| Email (SMTP) | provider-dependent | confirmation emails and password resets |

Worth knowing now: Prisma Postgres's per-operation model means a chatty page is a
billing event, not just a slow page.

**Also required before it is public:**

- [ ] Phase 1 complete and the isolation tests passing
- [ ] A privacy policy and terms, if you collect emails
- [ ] Account deletion path (or at least a documented manual process)
- [ ] Rate limiting on sign-up, so the endpoint cannot be scripted
- [ ] `KAIROS_NO_INDEX` left `false` only once the app is genuinely public
