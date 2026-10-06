"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * Supabase client for Client Components (only the sign-in form uses it).
 *
 * All task data still goes through Server Actions; the browser client only ever
 * talks to Supabase Auth.
 */
export function createSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY, then rebuild (NEXT_PUBLIC_* values are inlined at build time).",
    );
  }

  return createBrowserClient(url, anonKey);
}
