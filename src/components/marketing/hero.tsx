import { AppPreview } from "@/components/marketing/app-preview";
import { Button } from "@/components/ui/button";
import Link from "next/link";

/**
 * Opening section: the claim, the explanation, the two calls to action, and the
 * product itself as the main visual.
 *
 * A Server Component — everything here is static.
 */
export function Hero() {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 pb-16 pt-14 sm:px-6 sm:pb-24 sm:pt-20">
      <div className="mx-auto max-w-3xl text-center">
        <p className="inline-flex items-center rounded-full border border-border bg-muted/60 px-3 py-1 text-xs font-medium text-muted-foreground">
          Free · Open source · MIT licensed
        </p>

        <h1 className="mt-6 text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">
          Organise your tasks.{" "}
          <span className="text-primary">Focus on what matters.</span>
        </h1>

        <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
          Kairos groups your work by category and date, breaks the big things into
          subtasks, and shows you where your progress actually comes from — without the
          labels, priorities and settings that turn a task list into another project.
        </p>

        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button size="lg" asChild className="w-full sm:w-auto">
            <Link href="/register">Get started free</Link>
          </Button>
          <Button size="lg" variant="outline" asChild className="w-full sm:w-auto">
            <Link href="/login">Log in</Link>
          </Button>
        </div>
      </div>

      <div className="mt-14 sm:mt-16">
        <AppPreview />
        <p className="mt-3 text-center text-xs text-muted-foreground">
          An illustration of the workspace, with example tasks.
        </p>
      </div>
    </section>
  );
}
