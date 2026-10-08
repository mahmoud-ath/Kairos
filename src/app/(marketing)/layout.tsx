import type { ReactNode } from "react";

import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";

/**
 * Marketing area — the public site.
 *
 * Deliberately free of session lookups, database queries, Server Actions and the
 * workspace providers, so every page here stays statically renderable and works
 * whether or not Supabase is configured.
 */
export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
