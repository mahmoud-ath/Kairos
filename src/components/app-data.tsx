"use client";

import { createContext, useContext, type ReactNode } from "react";

import type { ViewCounts } from "@/lib/views";
import type { CategoryDTO, SettingsDTO } from "@/types/kairos";

/**
 * Data every page needs: settings, the categories used by the quick-add and
 * details panel, and the counters shown in the sidebar.
 *
 * Loaded once in the app layout (a Server Component) and shared with the client
 * tree, so individual pages only have to fetch their own task list.
 */
export type AppData = {
  settings: SettingsDTO;
  /** Today's date-only value in the user's configured timezone. */
  today: string;
  categories: CategoryDTO[];
  counts: ViewCounts;
  /** True when Supabase Auth is configured, i.e. there is a session to end. */
  authEnabled: boolean;
  /** The signed-in account's address, or `null` when the gate is switched off. */
  email: string | null;
};

const AppDataContext = createContext<AppData | null>(null);

export function AppDataProvider({
  value,
  children,
}: {
  value: AppData;
  children: ReactNode;
}) {
  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData(): AppData {
  const context = useContext(AppDataContext);
  if (!context) {
    throw new Error("useAppData must be used inside the app shell.");
  }
  return context;
}

/** Panel collapse state, shared between the shell and the page-level panel. */
type PanelState = {
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  toggle: () => void;
};

const PanelContext = createContext<PanelState | null>(null);

export function PanelProvider({
  value,
  children,
}: {
  value: PanelState;
  children: ReactNode;
}) {
  return <PanelContext.Provider value={value}>{children}</PanelContext.Provider>;
}

export function usePanelState(): PanelState {
  const context = useContext(PanelContext);
  if (!context) {
    throw new Error("usePanelState must be used inside the app shell.");
  }
  return context;
}

/**
 * The one search box for the whole workspace.
 *
 * It lives in the top bar rather than in each page's toolbar, so the query
 * survives navigating between views and every view filters by the same text.
 */
type SearchState = {
  query: string;
  setQuery: (query: string) => void;
  clear: () => void;
};

const SearchContext = createContext<SearchState | null>(null);

export function SearchProvider({
  value,
  children,
}: {
  value: SearchState;
  children: ReactNode;
}) {
  return <SearchContext.Provider value={value}>{children}</SearchContext.Provider>;
}

export function useSearch(): SearchState {
  const context = useContext(SearchContext);
  if (!context) {
    throw new Error("useSearch must be used inside the app shell.");
  }
  return context;
}
