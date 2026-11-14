import { Boxes, Database, ShieldCheck } from "lucide-react";
import Link from "next/link";

import { CodeBlock } from "@/components/marketing/code-block";
import { Button } from "@/components/ui/button";

/**
 * Self-hosting teaser.
 *
 * The landing page has to make the choice visible without turning into a manual:
 * the claim, three facts and the one command, with the details on `/self-host`.
 * Static, like the rest of the marketing area.
 */
const FACTS = [
  {
    icon: Boxes,
    title: "Compose does the wiring",
    description: "The app and PostgreSQL start together, in the right order.",
  },
  {
    icon: Database,
    title: "Your data stays on a volume",
    description: "Rebuilding the app never touches your tasks.",
  },
  {
    icon: ShieldCheck,
    title: "Loopback by default",
    description: "Published on 127.0.0.1, so it is not reachable from your network.",
  },
] as const;

export function SelfHostTeaser() {
  return (
    <section id="self-host" className="scroll-mt-20 border-t border-border/70">
      <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center lg:gap-16">
          <div>
            <p className="text-sm font-semibold text-primary">Self-hosting</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
              Your tasks, on your own hardware
            </h2>
            <p className="mt-3 text-base leading-relaxed text-muted-foreground">
              Kairos is a Next.js server beside a PostgreSQL database, and the repository
              ships the Compose file that runs both. Clone it, start it, and the workspace
              is yours — no outside services, no accounts unless you want them.
            </p>

            <ul className="mt-8 flex flex-col gap-4">
              {FACTS.map((fact) => (
                <li key={fact.title} className="flex gap-3">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                    <fact.icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span>
                    <span className="block text-sm font-medium text-foreground">
                      {fact.title}
                    </span>
                    <span className="block text-sm text-muted-foreground">
                      {fact.description}
                    </span>
                  </span>
                </li>
              ))}
            </ul>

            <div className="mt-8">
              <Button asChild>
                <Link href="/self-host">Read the Docker guide</Link>
              </Button>
            </div>
          </div>

          <CodeBlock
            label="Terminal — about a minute"
            code={[
              "git clone https://github.com/mahmoud-ath/Kairos.git",
              "cd Kairos",
              "cp .env.example .env   # set KAIROS_AUTH_DISABLED=true",
              "docker compose up -d --build",
              "",
              "# → http://127.0.0.1:3000",
            ].join("\n")}
          />
        </div>
      </div>
    </section>
  );
}
