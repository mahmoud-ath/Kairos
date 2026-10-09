"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Brand } from "@/components/marketing/brand";
import { MARKETING_NAV } from "@/components/marketing/nav";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Button } from "@/components/ui/button";

/**
 * Public navigation.
 *
 * The only interactive part of the landing page, so it is the only Client
 * Component: it holds the open/closed state of the mobile menu. The links
 * themselves are plain anchors, and every focusable element gets the global
 * `:focus-visible` ring from `globals.css`.
 */
export function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-6 px-4 sm:px-6">
        <Brand />

        <nav aria-label="Sections" className="hidden items-center gap-1 md:flex">
          {MARKETING_NAV.map((link) => (
            <Link
              key={link.href}
              // Root-relative, so the same header works on `/login` as well as
              // on the landing page: `#features` alone would go nowhere there.
              href={`/${link.href}`}
              className="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
        </div>

        <div className="hidden items-center gap-2 md:flex">
          <Button variant="ghost" asChild>
            <Link href="/login">Log in</Link>
          </Button>
          <Button asChild>
            <Link href="/register">Get started</Link>
          </Button>
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          aria-expanded={open}
          aria-controls="marketing-mobile-nav"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      {open ? (
        <div id="marketing-mobile-nav" className="border-t border-border md:hidden">
          <nav
            aria-label="Sections"
            className="mx-auto flex w-full max-w-6xl flex-col px-4 py-3 sm:px-6"
          >
            {MARKETING_NAV.map((link) => (
              <Link
                key={link.href}
                href={`/${link.href}`}
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                {link.label}
              </Link>
            ))}

            <div className="mt-3 flex flex-col gap-2 border-t border-border pt-4">
              <Button variant="outline" asChild>
                <Link href="/login">Log in</Link>
              </Button>
              <Button asChild>
                <Link href="/register">Get started</Link>
              </Button>
              <div className="flex items-center justify-between px-1 pt-2">
                <span className="text-xs text-muted-foreground">Theme</span>
                <ThemeToggle />
              </div>
            </div>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
