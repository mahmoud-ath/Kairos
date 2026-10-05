"use client";

import { ThemeProvider } from "next-themes";
import type { ReactNode } from "react";

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { ThemePreference } from "@/types/kairos";

/**
 * Theme + toast + tooltip providers.
 *
 * The theme stored in the database is only used as the initial value; switching
 * themes applies instantly through `next-themes` and is then persisted by the
 * settings form.
 */
export function Providers({
  children,
  initialTheme,
}: {
  children: ReactNode;
  initialTheme: ThemePreference;
}) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme={initialTheme}
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
