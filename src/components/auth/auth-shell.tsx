import type { ReactNode } from "react";

/**
 * The frame both auth pages share: brand, heading, and a centred card.
 *
 * A Server Component — the pages pass the interactive form in as `children`.
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
    <main className="grid min-h-screen place-items-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
            K
          </span>
          <div>
            <p className="text-sm font-semibold leading-none tracking-tight">Kairos</p>
            <p className="mt-0.5 text-[11px] leading-none text-muted-foreground">
              Tasks, subtasks and progress
            </p>
          </div>
        </div>

        <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>

        <div className="mt-6">{children}</div>
      </div>
    </main>
  );
}
