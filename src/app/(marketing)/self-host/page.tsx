import { Boxes, Database, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { CodeBlock } from "@/components/marketing/code-block";
import { REPOSITORY_URL } from "@/components/marketing/nav";
import { Button } from "@/components/ui/button";
import { viewMetadata } from "@/lib/site";

/**
 * Self-hosting guide: run Kairos locally with Docker Compose.
 *
 * A Server Component with no dynamic inputs, like the rest of the marketing
 * area, so it stays statically renderable. The commands here are the ones the
 * repository actually ships (`compose.yaml`, `docker/entrypoint.sh`, `.env.example`)
 * — if one of those changes, this page has to change with it.
 */
export const metadata: Metadata = viewMetadata({
  title: "Run it locally with Docker",
  description:
    "Run Kairos on your own machine with Docker Compose: one command builds the app, starts PostgreSQL, applies the migrations and serves it on 127.0.0.1. No accounts, no outside services.",
  path: "/self-host",
});

/** A titled block of the guide. */
function Section({
  id,
  title,
  children,
}: {
  id?: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className={id ? "scroll-mt-24" : undefined}>
      <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h2>
      <div className="mt-4 flex flex-col gap-4 text-sm leading-relaxed text-muted-foreground">
        {children}
      </div>
    </section>
  );
}

/** One numbered step, with the text and the snippet it refers to. */
function Step({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <li className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-primary/25 bg-primary/10 text-xs font-semibold text-primary">
          {number}
        </span>
        <h3 className="text-base font-semibold tracking-tight text-foreground">{title}</h3>
      </div>
      <div className="flex flex-col gap-3 pl-10 text-sm leading-relaxed text-muted-foreground">
        {children}
      </div>
    </li>
  );
}

export default function SelfHostPage() {
  return (
    <div className="border-b border-border/70">
      {/* Opening ---------------------------------------------------------- */}
      <div className="mx-auto w-full max-w-6xl px-4 pb-14 pt-14 sm:px-6 sm:pb-16 sm:pt-20">
        <div className="max-w-3xl">
          <p className="inline-flex items-center rounded-full border border-border bg-muted/60 px-3 py-1 text-xs font-medium text-muted-foreground">
            Self-hosting · Docker Compose
          </p>
          <h1 className="mt-6 text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
            Run Kairos on your own machine
          </h1>
          <p className="mt-5 text-base leading-relaxed text-muted-foreground sm:text-lg">
            Kairos is a Next.js server plus a PostgreSQL database, and both are wired
            together in the repository with Docker Compose. One command builds the image,
            starts the database, applies the migrations and serves the app on
            <code className="mx-1 rounded bg-muted px-1.5 py-0.5 font-mono text-[0.9em] text-foreground">
              127.0.0.1:3000
            </code>
            — no accounts to create, no outside services, nothing to configure first.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button size="lg" asChild className="w-full sm:w-auto">
              <a href="#quickstart">Show me the commands</a>
            </Button>
            <Button size="lg" variant="outline" asChild className="w-full sm:w-auto">
              <a href={REPOSITORY_URL} target="_blank" rel="noreferrer">
                View the repository
              </a>
            </Button>
          </div>
        </div>
      </div>

      {/* Quick start ------------------------------------------------------ */}
      <div id="quickstart" className="scroll-mt-24 border-t border-border/70 bg-muted/30">
        <div className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6 sm:py-20">
          <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">Quick start</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Four commands, about a minute. Everything below assumes a terminal in the
            folder you cloned into.
          </p>

          <ol className="mt-10 flex flex-col gap-10">
            <Step number={1} title="Get the code">
              <p>
                Clone the repository and step into it. Nothing needs to be installed on
                the host — the toolchain lives inside the image.
              </p>
              <CodeBlock
                code={[
                  `git clone ${REPOSITORY_URL}.git`,
                  "cd Kairos",
                ].join("\n")}
              />
            </Step>

            <Step number={2} title="Decide how sign-in works">
              <p>
                Copy the sample environment file. For a private, single-workspace
                installation the only line you need to change is{" "}
                <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.9em] text-foreground">
                  KAIROS_AUTH_DISABLED=true
                </code>{" "}
                — there is then no sign-up, and everyone who can reach the port shares one
                workspace.
              </p>
              <CodeBlock
                code={["cp .env.example .env", "# then edit .env: KAIROS_AUTH_DISABLED=true"].join(
                  "\n",
                )}
              />
              <p>
                If you want real accounts instead, fill in{" "}
                <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.9em] text-foreground">
                  NEXT_PUBLIC_SUPABASE_URL
                </code>{" "}
                and{" "}
                <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.9em] text-foreground">
                  NEXT_PUBLIC_SUPABASE_ANON_KEY
                </code>
                . Those two are inlined at <em>build</em> time, so after changing them the
                image has to be rebuilt — a plain{" "}
                <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.9em] text-foreground">
                  docker compose up -d
                </code>{" "}
                would keep the old values without complaining.
              </p>
            </Step>

            <Step number={3} title="Build and start">
              <p>
                Compose builds the app image, starts PostgreSQL beside it, waits for the
                database to accept connections, runs{" "}
                <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.9em] text-foreground">
                  prisma migrate deploy
                </code>{" "}
                and then serves the app.
              </p>
              <CodeBlock code="docker compose up -d --build" />
            </Step>

            <Step number={4} title="Open it">
              <p>
                Kairos is published on the loopback interface, so it is not reachable from
                your network unless you change that. Your workspace starts empty: add a
                task, or load the example data from the empty screen.
              </p>
              <CodeBlock label="Browser" code="http://127.0.0.1:3000" />
            </Step>
          </ol>
        </div>
      </div>

      {/* What the stack is ------------------------------------------------ */}
      <div className="border-t border-border/70">
        <div className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6 sm:py-20">
          <Section title="What the stack actually does">
            <ul className="flex flex-col gap-4">
              <li className="flex gap-3">
                <Boxes className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                <span>
                  <span className="font-medium text-foreground">Two containers.</span>{" "}
                  <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.9em] text-foreground">
                    kairos
                  </code>{" "}
                  serves the app and{" "}
                  <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.9em] text-foreground">
                    kairos-db
                  </code>{" "}
                  runs PostgreSQL 16. The app container runs as the unprivileged{" "}
                  <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.9em] text-foreground">
                    node
                  </code>{" "}
                  user.
                </span>
              </li>
              <li className="flex gap-3">
                <Database className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                <span>
                  <span className="font-medium text-foreground">Your data lives on a volume.</span>{" "}
                  The database is stored on the{" "}
                  <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.9em] text-foreground">
                    kairos-db
                  </code>{" "}
                  volume, never inside the image — so rebuilding the app keeps your tasks.
                </span>
              </li>
              <li className="flex gap-3">
                <ShieldCheck
                  className="mt-0.5 h-4 w-4 shrink-0 text-primary"
                  aria-hidden="true"
                />
                <span>
                  <span className="font-medium text-foreground">Migrations run on start.</span>{" "}
                  Upgrading is a rebuild and a restart; there is no separate migration step
                  to remember, and no restart loop if the database is still booting.
                </span>
              </li>
            </ul>
            <p>
              The app is designed as a single instance — it is not meant to be scaled
              horizontally. A health check polls{" "}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.9em] text-foreground">
                /api/health
              </code>
              , which also verifies the database, so{" "}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.9em] text-foreground">
                docker compose ps
              </code>{" "}
              tells you whether the whole stack is actually working.
            </p>
            <CodeBlock
              code={[
                "docker compose ps                        # both services healthy?",
                'curl -s localhost:3000/api/health        # {"ok":true,"database":"ok"}',
                "docker compose logs -f kairos            # migrations and warnings",
              ].join("\n")}
            />
          </Section>
        </div>
      </div>

      {/* Everyday commands ------------------------------------------------- */}
      <div className="border-t border-border/70 bg-muted/30">
        <div className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6 sm:py-20">
          <Section title="Everyday commands">
            <div className="overflow-x-auto rounded-lg border border-border bg-card">
              <table className="w-full text-left text-sm">
                <caption className="sr-only">Common Docker Compose commands</caption>
                <thead className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-4 py-2.5 font-medium">
                      Task
                    </th>
                    <th scope="col" className="px-4 py-2.5 font-medium">
                      Command
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {[
                    ["Follow the logs", "docker compose logs -f kairos"],
                    ["Stop, keeping your data", "docker compose down"],
                    ["Update to the latest code", "git pull && docker compose up -d --build"],
                    ["Restart after editing .env", "docker compose up -d --build"],
                  ].map(([task, command]) => (
                    <tr key={task}>
                      <td className="px-4 py-2.5 align-top text-muted-foreground">{task}</td>
                      <td className="px-4 py-2.5">
                        <code className="font-mono text-xs text-foreground">{command}</code>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/5 px-4 py-3">
              <span className="mt-0.5 text-sm" aria-hidden="true">
                ⚠️
              </span>
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">
                  <code className="font-mono">docker compose down -v</code> deletes the
                  volume
                </span>{" "}
                — and with it every task, habit and category. Export a JSON backup from
                Settings first if you are not sure.
              </p>
            </div>
          </Section>
        </div>
      </div>

      {/* Configuration ---------------------------------------------------- */}
      <div className="border-t border-border/70">
        <div className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6 sm:py-20">
          <Section id="configuration" title="Configuration">
            <p>
              Everything is read from <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.9em] text-foreground">.env</code>{" "}
              at the repository root. The values most people touch:
            </p>
            <div className="overflow-x-auto rounded-lg border border-border bg-card">
              <table className="w-full text-left text-sm">
                <caption className="sr-only">Environment variables</caption>
                <thead className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-4 py-2.5 font-medium">
                      Variable
                    </th>
                    <th scope="col" className="px-4 py-2.5 font-medium">
                      Default
                    </th>
                    <th scope="col" className="px-4 py-2.5 font-medium">
                      What it does
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {[
                    ["KAIROS_PORT", "3000", "Host port the app is published on."],
                    [
                      "KAIROS_BIND_HOST",
                      "127.0.0.1",
                      "Host interface to bind. Loopback = not reachable from your network.",
                    ],
                    [
                      "KAIROS_DB_PASSWORD",
                      "kairos",
                      "PostgreSQL password. Only read when the volume is first created.",
                    ],
                    [
                      "NEXT_PUBLIC_APP_URL",
                      "http://localhost:3000",
                      "Public origin, used by canonical links, the sitemap and social cards.",
                    ],
                    [
                      "KAIROS_NO_INDEX",
                      "false",
                      "\"true\" asks every crawler to stay away.",
                    ],
                  ].map(([name, fallback, effect]) => (
                    <tr key={name}>
                      <td className="px-4 py-2.5 align-top">
                        <code className="font-mono text-xs text-foreground">{name}</code>
                      </td>
                      <td className="px-4 py-2.5 align-top font-mono text-xs text-muted-foreground">
                        {fallback}
                      </td>
                      <td className="px-4 py-2.5 align-top text-muted-foreground">{effect}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p>
              The daily reminder is optional and off until you configure it: generate a
              Web Push key pair, put the public key next to the private one in{" "}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.9em] text-foreground">
                .env
              </code>
              , and rebuild. Without keys, Settings simply says notifications are not
              configured for this deployment — nothing else changes.
            </p>
          </Section>
        </div>
      </div>

      {/* Exposing it ------------------------------------------------------ */}
      <div className="border-t border-border/70 bg-muted/30">
        <div className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6 sm:py-20">
          <Section title="Before you put it on the internet">
            <p>
              The defaults are deliberately conservative: the app listens on{" "}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.9em] text-foreground">
                127.0.0.1
              </code>
              , so it is reachable only from the machine running it. If you want it on your
              LAN or a domain, change that knowingly:
            </p>
            <ul className="flex list-disc flex-col gap-2 pl-5">
              <li>
                Never leave{" "}
                <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.9em] text-foreground">
                  KAIROS_AUTH_DISABLED=true
                </code>{" "}
                on a port that other people can reach — every visitor would share the one
                workspace.
              </li>
              <li>
                For a public domain, put a reverse proxy (Caddy, nginx, Traefik) in front
                for TLS, and set{" "}
                <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.9em] text-foreground">
                  NEXT_PUBLIC_APP_URL
                </code>{" "}
                to the real origin before building.
              </li>
              <li>
                Use Supabase sign-in (or an authenticating proxy) rather than opening a
                single shared workspace to the world.
              </li>
            </ul>
          </Section>
        </div>
      </div>

      {/* Data ------------------------------------------------------------- */}
      <div className="border-t border-border/70">
        <div className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6 sm:py-20">
          <Section title="Your data, and getting it out">
            <p>
              Tasks live in PostgreSQL. Two independent ways exist to keep or move them:
            </p>
            <ul className="flex list-disc flex-col gap-2 pl-5">
              <li>
                <span className="font-medium text-foreground">JSON backup</span> — Settings
                → Backup &amp; data → Export JSON writes one versioned file with tasks,
                subtasks, habits, categories, history and settings. Import it back into any
                Kairos instance, including this one after a reset.
              </li>
              <li>
                <span className="font-medium text-foreground">The volume</span> — the{" "}
                <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.9em] text-foreground">
                  kairos-db
                </code>{" "}
                volume survives rebuilds and restarts. Back that volume up the same way you
                back up any PostgreSQL database if you want the byte-level copy.
              </li>
            </ul>
            <p>
              Task transfer is also available without a full backup: switch on{" "}
              <span className="text-foreground">Settings → Header tools</span> and the top
              bar gains a JSON export/import menu for the task list alone.
            </p>
          </Section>
        </div>
      </div>

      {/* Closing ---------------------------------------------------------- */}
      <div className="border-t border-border/70 bg-muted/30">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <div className="rounded-lg border border-border bg-card px-6 py-12 text-center sm:px-12">
            <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
              Prefer not to run a server?
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
              The hosted version needs nothing installed, and the data model is the same —
              the JSON backup moves your workspace between the two in either direction.
            </p>
            <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button size="lg" asChild className="w-full sm:w-auto">
                <Link href="/register">Get started free</Link>
              </Button>
              <Button size="lg" variant="outline" asChild className="w-full sm:w-auto">
                <Link href="/">Back to the overview</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
