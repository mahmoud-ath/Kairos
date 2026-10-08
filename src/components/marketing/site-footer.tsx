import { ExternalLink } from "lucide-react";
import Link from "next/link";

import { Brand } from "@/components/marketing/brand";
import { LICENSE_URL, MARKETING_NAV, REPOSITORY_URL } from "@/components/marketing/nav";

/**
 * Public footer.
 *
 * There are no privacy or terms pages in this project, so there are no links to
 * them: a footer full of dead links is worse than a short one.
 */
export function SiteFooter() {
  return (
    <footer className="border-t border-border/70 bg-muted/30">
      <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        <div className="flex flex-col gap-10 sm:flex-row sm:justify-between">
          <div className="max-w-xs">
            <Brand />
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              An open-source task manager that organises work by category and date.
            </p>
          </div>

          <div className="flex gap-12 sm:gap-16">
            <nav aria-label="Product">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Product
              </p>
              <ul className="mt-3 flex flex-col gap-2 text-sm">
                {MARKETING_NAV.map((link) => (
                  <li key={link.href}>
                    <a
                      href={link.href}
                      className="rounded text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>

            <nav aria-label="Account">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Account
              </p>
              <ul className="mt-3 flex flex-col gap-2 text-sm">
                <li>
                  <Link
                    href="/register"
                    className="rounded text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Create an account
                  </Link>
                </li>
                <li>
                  <Link
                    href="/login"
                    className="rounded text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Log in
                  </Link>
                </li>
              </ul>
            </nav>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            Released under the{" "}
            <a
              href={LICENSE_URL}
              target="_blank"
              rel="noreferrer"
              className="rounded underline underline-offset-2 transition-colors hover:text-foreground"
            >
              MIT license
            </a>
            .
          </p>

          <a
            href={REPOSITORY_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            View the source on GitHub
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
    </footer>
  );
}
