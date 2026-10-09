import type { ReactNode } from "react";

import { SiteHeader } from "@/components/marketing/site-header";

/**
 * Authentication area — `/login` and `/register`.
 *
 * A route group, so it adds no URL segment: the routes stay at `/login` and
 * `/register` rather than moving under `/auth`.
 *
 * This layout owns the page frame: the same header the landing page uses, so the
 * brand and the way back are always in the same place, plus the ambient
 * background and the centring. The card itself is `AuthShell`, a Server
 * Component; only the form is interactive.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col">
      {/* Two slow, blurred blooms instead of a flat background. Decorative only. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="animate-drift absolute -left-40 -top-40 h-[26rem] w-[26rem] rounded-full bg-primary/10 blur-3xl" />
        <div className="animate-drift absolute -bottom-48 -right-32 h-[22rem] w-[22rem] rounded-full bg-primary/[0.07] blur-3xl [animation-delay:4s]" />
      </div>

      <SiteHeader />

      <main className="relative flex flex-1 items-center justify-center px-4 py-10 sm:py-14">
        {children}
      </main>
    </div>
  );
}
