"use client";

import { ThemeProvider } from "next-themes";
import type { ReactNode } from "react";

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { THEME_STORAGE_KEY } from "@/lib/constants";
import type { ThemePreference } from "@/types/kairos";

/**
 * Theme + toast + tooltip providers.
 *
 * Mounted at the root so the landing page and the sign-in pages get a theme
 * too: without a `ThemeProvider` above them, `next-themes` never injects its
 * pre-paint script, no `.dark` class is ever added, and a dark-mode preference
 * is simply ignored outside the workspace.
 *
 * The theme stored in the database cannot be read here — the root layout does
 * not know who is signed in — so the default follows the operating system and
 * `ThemeSync` applies the stored preference inside the workspace.
 */
export function Providers({
  children,
  initialTheme = "system",
}: {
  children: ReactNode;
  initialTheme?: ThemePreference;
}) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme={initialTheme}
      storageKey={THEME_STORAGE_KEY}
      enableSystem
      disableTransitionOnChange
    >
      <TooltipProvider delayDuration={300}>
        {children}
        <Toaster position="bottom-right" closeButton richColors />
      </TooltipProvider>
    </ThemeProvider>
  );
}
