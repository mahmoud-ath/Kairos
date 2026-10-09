import { ChartNoAxesColumn, ListTodo, ShieldCheck } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * What the app does, in three lines. Icons carry the meaning: the sign-in page
 * is not the place for a feature list.
 */
const HIGHLIGHTS = [
  { Icon: ListTodo, label: "Tasks, subtasks, categories" },
  { Icon: ChartNoAxesColumn, label: "Progress you can see" },
  { Icon: ShieldCheck, label: "Private to your account" },
] as const;

/** Staggered entrances — literal class names, so Tailwind can see them. */
const DELAYS = ["animate-delay-1", "animate-delay-2", "animate-delay-3"] as const;

/**
 * The frame both auth pages share: a brand panel on the left, the form on the
 * right.
 *
 * A Server Component — the pages pass the interactive form in as `children`. The
 * header, the page background and the centring frame belong to the `(auth)`
 * layout, so this only owns the card.
 */
export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="animate-pop-in grid w-full max-w-4xl overflow-hidden rounded-2xl border border-border bg-card shadow-xl shadow-black/5 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1fr)]">
      <aside className="hidden flex-col justify-between gap-10 border-r border-border bg-sidebar p-8 lg:flex">
        <Link
          href="/"
          className="flex w-fit items-center gap-2.5 rounded-md transition-opacity hover:opacity-80"
        >
          <span className="grid h-8 w-8 place-items-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
            K
          </span>
          <span className="text-sm font-semibold tracking-tight">
            Kairos
          </span>
        </Link>

        <ul className="flex flex-col gap-5">
          {HIGHLIGHTS.map(({ Icon, label }, index) => (
            <li
              key={label}
              className={cn(
                "animate-fade-up flex items-center gap-3 text-sm text-sidebar-foreground/80",
                DELAYS[index],
              )}
            >
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
              {label}
            </li>
          ))}
        </ul>

        <p className="text-xs text-muted-foreground">Open source · self-hosted</p>
      </aside>

      <div className="flex flex-col justify-center gap-6 p-6 sm:p-8">
        {/* The brand panel is hidden on small screens, so the mark moves here. */}
        <Link
          href="/"
          className="flex w-fit items-center gap-2.5 rounded-md transition-opacity hover:opacity-80 lg:hidden"
        >
          <span className="grid h-8 w-8 place-items-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
            K
          </span>
          <span className="text-sm font-semibold tracking-tight">Kairos</span>
        </Link>

        <header className="flex flex-col gap-1.5">
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </header>

        {children}
      </div>
    </div>
  );
}
