"use client";

import { useTheme } from "next-themes";
import { useEffect, useRef } from "react";

import { THEME_STORAGE_KEY } from "@/lib/constants";
import type { ThemePreference } from "@/types/kairos";

/**
 * Applies the theme stored in the database.
 *
 * The root `ThemeProvider` cannot know it: the landing page and the sign-in
 * pages are rendered without a session, so their default follows the operating
 * system. Inside the workspace the stored preference takes over — but only in a
 * browser that has never expressed one, because a choice made in *this* browser
 * is newer than a preference saved on another device.
 */
export function ThemeSync({ preferred }: { preferred: ThemePreference }) {
  const { setTheme } = useTheme();
  const applied = useRef(false);

  useEffect(() => {
    if (applied.current) return;
    applied.current = true;

    if (window.localStorage.getItem(THEME_STORAGE_KEY)) return;
    setTheme(preferred);
  }, [preferred, setTheme]);

  return null;
}
