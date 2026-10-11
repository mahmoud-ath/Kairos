"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";

import {
  AppDataProvider,
  PanelProvider,
  SearchProvider,
  type AppData,
} from "@/components/app-data";
import { DragProvider } from "@/components/dnd/drag-provider";
import { AppTopbar } from "@/components/layout/app-topbar";
import { FontScaleSync } from "@/components/layout/font-scale-sync";
import { ShortcutProvider } from "@/components/layout/shortcut-provider";
import { SidebarContent } from "@/components/layout/sidebar";
import { ThemeSync } from "@/components/layout/theme-sync";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

/**
 * The app frame: sidebar, a top bar, the main workspace, and the page-level
 * progress panel (rendered by each page so it can show that page's numbers).
 *
 * Below `lg` the sidebar becomes a drawer opened from the top bar; the progress
 * panel moves behind a button in the page toolbar.
 *
 * This is also where the workspace-only providers live: the shortcut listener,
 * the global search box and the theme sync — none of them belong on the landing
 * or sign-in pages.
 */
export function AppShell({ data, children }: { data: AppData; children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [query, setQuery] = useState("");

  const panelState = {
    collapsed,
    setCollapsed,
    toggle: () => setCollapsed((value) => !value),
  };

  const clearSearch = useCallback(() => setQuery(""), []);
  const searchState = useMemo(
    () => ({ query, setQuery, clear: clearSearch }),
    [query, clearSearch],
  );

  return (
    <ShortcutProvider>
      <AppDataProvider value={data}>
        <SearchProvider value={searchState}>
          <PanelProvider value={panelState}>
            <DragProvider>
              {/* The theme lives in the root provider; this applies the stored one. */}
              <ThemeSync preferred={data.settings.theme} />
              {/* Text size is a root font size, so it is applied to <html>. */}
              <FontScaleSync preferred={data.settings.fontScale} />

              <div className="flex min-h-screen w-full items-start overflow-x-clip">
                <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r border-sidebar-border bg-sidebar lg:flex lg:flex-col">
                  <SidebarContent />
                </aside>

                <div className="flex min-w-0 flex-1 flex-col">
                  <AppTopbar onOpenNav={() => setSidebarOpen(true)} />
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
        </SearchProvider>
      </AppDataProvider>
    </ShortcutProvider>
  );
}
