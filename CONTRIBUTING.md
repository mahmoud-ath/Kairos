# Contributing to Kairos

Thanks for taking the time to help. Kairos is deliberately small: it is a
personal, self-hosted task manager, and the project values clarity over
features.

## Getting set up

```bash
git clone <your-fork-url> kairos
cd kairos
cp .env.example .env
bun install
bunx prisma migrate deploy
bun run dev
```

Requires Node.js 22+ and [Bun](https://bun.sh). Please use `bun` rather than
`npm`/`yarn`/`pnpm` so the committed `bun.lock` stays authoritative.

## Before you open a pull request

Run the whole check suite — all four must pass:

```bash
bun run typecheck
bun run lint
bun test
bun run test:e2e      # builds the app, then runs Playwright
```

The end-to-end suite (`tests/e2e`) shares one throw-away SQLite database per run,
so specs must not depend on the workspace being empty. `task-workflow.spec.ts`
resets all data through the settings UI before it starts; the other specs only
touch tasks they created themselves. Note that Playwright can see the previous
route's (hidden) DOM for a moment after a client-side navigation — assert on
counts or scope locators to the row you are working with.

A few project conventions worth following:

- **Keep business rules in `src/lib`.** Anything that decides *what* is overdue,
  how sections group, or how ordering is computed belongs in a pure module with a
  unit test, not in a component or a route.
- **Keep database access in `src/server/services`.** Server Actions validate
  input with Zod and then call a service — they never query Prisma directly.
- **Never trust the client.** Validate ids, dates, text lengths and relationships
  on the server, even when the UI already prevents a case.
- **Server Components read, Server Actions write, Client Components interact.**
  Don't fetch data in the browser; don't add a second data-fetching library.
- **Optimistic updates must roll back.** If a save can fail, the UI has to revert
  and explain what happened.
- **Accessibility is part of the feature.** Interactive controls need names,
  focus must be visible, and every drag-and-drop action needs a keyboard
  equivalent.
- **Product scope.** Categories are the only grouping; there are no labels or
  priorities. Subtasks are one level deep. New tasks are dated today. Keep the UI
  quiet: one accent colour (green), neutral surfaces, no gradients or glass
  effects.

## Database changes

1. Edit `prisma/schema.prisma`.
2. Create the migration: `bun run db:migrate --name describe_your_change`.
3. Commit the generated `prisma/migrations/**` directory — it is applied
   automatically on container start.

Deletion behaviour must always be explicit (`Cascade`, `SetNull`, …). Deleting a
category must never delete tasks.

Because `schema.prisma` is pushed to existing databases on start, keep migrations
small and additive where possible; if a migration drops data, say so in the pull
request and mention it in the README.

## Reporting bugs

Please include:

- what you did, what you expected, what happened instead
- Kairos version/commit, plus how you run it (local or Docker)
- the relevant server output (`docker compose logs kairos` or the terminal)
- whether your data still round-trips through **Settings → Export JSON**

## Security

Kairos v1 has **no authentication** and is meant for localhost or a trusted
private network. If you find a way for unauthenticated users to reach data beyond
what the app already exposes (for example a way to escape the intended local
deployment), please report it privately rather than in a public issue.

## License

By contributing you agree that your work is licensed under the [MIT License](LICENSE).
