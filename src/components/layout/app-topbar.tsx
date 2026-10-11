"use client";

import { LogOut, Menu, Search, Settings, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { useAppData, useSearch } from "@/components/app-data";
import { AvatarArt } from "@/components/layout/avatar";
import { ShortcutTrigger } from "@/components/layout/shortcut-provider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { SEARCH_INPUT_ID } from "@/lib/constants";
import { displayName } from "@/lib/profile";
import { signOutAction } from "@/server/actions/auth";

/**
 * The workspace top bar: a greeting, the filter box for the current page, the
 * keyboard-shortcut button and the account menu.
 *
 * Laid out as three defined areas — greeting, filter box, account controls — so
 * the filter box cannot drift sideways as the nickname grows or shrinks. The
 * greeting has a fixed width and truncates; the filter box is centred and capped
 * on desktop; the controls are constant.
 *
 * It spans the main column at every size — below `lg` it is also the only place
 * the navigation drawer can be opened from.
 */
export function AppTopbar({ onOpenNav }: { onOpenNav?: () => void }) {
  const { settings, email, authEnabled } = useAppData();
  const { query, setQuery, clear } = useSearch();
  const [menuOpen, setMenuOpen] = useState(false);
  const name = displayName(settings.nickname, email);

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-background/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:px-4">
      {onOpenNav ? (
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0 lg:hidden"
          aria-label="Open navigation"
          onClick={onOpenNav}
        >
          <Menu className="h-5 w-5" />
        </Button>
      ) : null}

      {/* Area 1 — greeting. A fixed width keeps a long nickname from pushing
          the filter box around; the value itself truncates. */}
      <p className="hidden w-52 shrink-0 truncate text-sm text-muted-foreground md:block">
        Welcome back, <span className="font-medium text-foreground">{name}</span>
      </p>

      {/* Area 2 — the filter box: centred, capped at 28rem on desktop. */}
      <div className="flex min-w-0 flex-1 justify-center px-1">
        <div className="relative w-full max-w-md">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id={SEARCH_INPUT_ID}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") clear();
            }}
            placeholder="Filter tasks on this page…"
            aria-label="Filter tasks on this page"
            className="h-9 pl-9 pr-9"
          />
          {query ? (
            <button
              type="button"
              onClick={clear}
              aria-label="Clear filter"
              className="absolute right-1.5 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      </div>

      {/* Area 3 — workspace actions. */}
      <div className="flex shrink-0 items-center gap-0.5">
        <ShortcutTrigger />

        {/* The span keeps the tooltip and the menu trigger off one element. */}
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex">
              <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-full"
                    aria-label={`Account & settings for ${name}`}
                  >
                    <AvatarArt
                      avatarId={settings.avatarId}
                      className="h-8 w-8 ring-1 ring-border"
                      glyphClassName="text-sm"
                    />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="flex flex-col gap-0.5">
                    <span className="truncate text-sm font-medium">{name}</span>
                    <span className="truncate text-xs font-normal text-muted-foreground">
                      {email ?? "Local workspace"}
                    </span>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/settings#profile">
                      <Settings />
                      Profile &amp; settings
                    </Link>
                  </DropdownMenuItem>
                  {authEnabled && email ? (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onSelect={() => {
                          void signOutAction();
                        }}
                      >
                        <LogOut />
                        Sign out
                      </DropdownMenuItem>
                    </>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
            </span>
          </TooltipTrigger>
          <TooltipContent>Account &amp; settings</TooltipContent>
        </Tooltip>
      </div>
    </header>
  );
}
