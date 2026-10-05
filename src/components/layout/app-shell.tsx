"use client";

import { Menu, Settings } from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";

import { AppDataProvider, PanelProvider, type AppData } from "@/components/app-data";
import { DragProvider } from "@/components/dnd/drag-provider";
import { SidebarContent } from "@/components/layout/sidebar";
import { Providers } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

/**
 * The three-part app frame: sidebar, main workspace, and the page-level
 * progress panel (rendered by each page so it can show that page's numbers).
 *
 * Below `lg` the sidebar becomes a drawer; the progress panel moves behind a
 * button in the page toolbar.
 */
export function AppShell({ data, children }: { data: AppData; children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const panelState = {
    collapsed,
    setCollapsed,
    toggle: () => setCollapsed((value) => !value),
  };

  return (
    <Providers initialTheme={data.settings.theme}>
      <AppDataProvider value={data}>
        <PanelProvider value={panelState}>
          <DragProvider>
            <div className="flex min-h-screen w-full items-start overflow-x-clip">
              <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r border-sidebar-border bg-sidebar lg:flex lg:flex-col">
                <SidebarContent />
              </aside>

              <div className="flex min-w-0 flex-1 flex-col">
                <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-background px-4 lg:hidden">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Open navigation"
                    onClick={() => setSidebarOpen(true)}
                  >
                    <Menu className="h-5 w-5" />
                  </Button>
                  <span className="text-sm font-semibold tracking-tight">Kairos</span>
                  <div className="ml-auto flex items-center gap-1">
                    <Button variant="ghost" size="icon" asChild>
                      <Link href="/settings" aria-label="Settings">
                        <Settings className="h-5 w-5" />
                      </Link>
                    </Button>
                  </div>
                </header>

                <main className="min-w-0 flex-1 pb-8">{children}</main>
              </div>
            </div>

            <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
              <SheetContent side="left" className="w-72 bg-sidebar p-0">
                <SheetTitle className="sr-only">Navigation</SheetTitle>
                <SidebarContent onNavigate={() => setSidebarOpen(false)} />
              </SheetContent>
            </Sheet>
          </DragProvider>
        </PanelProvider>
      </AppDataProvider>
    </Providers>
  );
}
