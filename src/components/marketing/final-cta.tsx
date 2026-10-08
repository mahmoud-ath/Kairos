import Link from "next/link";

import { Button } from "@/components/ui/button";

/** Closing call to action, repeated so the page ends on a next step. */
export function FinalCta() {
  return (
    <section className="border-t border-border/70">
      <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
        <div className="rounded-lg border border-border bg-card px-6 py-14 text-center sm:px-12">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Start with one task
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-base leading-relaxed text-muted-foreground">
            Create an account and your workspace is ready. It is free, and it stays
            yours — every account gets its own private tasks, categories and settings.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button size="lg" asChild className="w-full sm:w-auto">
              <Link href="/register">Get started free</Link>
            </Button>
            <Button size="lg" variant="outline" asChild className="w-full sm:w-auto">
              <Link href="/login">Log in</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
