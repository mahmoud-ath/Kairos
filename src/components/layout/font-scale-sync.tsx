"use client";

import { useEffect } from "react";

import { FONT_SCALES } from "@/lib/constants";
import type { FontScale } from "@/types/kairos";

/**
 * Applies the text size stored in the account.
 *
 * It has to be written to `<html>` rather than to a wrapper element: every
 * Tailwind size is in rem, and rem is resolved against the root font size, so
 * anything else would scale only part of the interface.
 */
export function FontScaleSync({ preferred }: { preferred: FontScale }) {
  useEffect(() => {
    document.documentElement.style.fontSize = `${FONT_SCALES[preferred]}%`;
  }, [preferred]);

  return null;
}
