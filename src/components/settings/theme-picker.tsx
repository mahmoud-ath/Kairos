"use client";

import { Check } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { THEME_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { ThemePreference } from "@/types/kairos";
import { updateSettingsAction } from "@/server/actions/settings";

/**
 * A miniature of each theme: the canvas, the raised surface, and the accent.
 *
 * Real colours rather than tokens, because the point of the preview is to show
 * what the *other* theme looks like — a preview that follows the current theme
 * would show nothing at all.
 */
const CHOICES: { value: ThemePreference; stripes: string[] }[] = [
  { value: "light", stripes: ["#ffffff", "#f4f4f5", "#15803d"] },
  { value: "dark", stripes: ["#1f1f1f", "#2b2b2b", "#4ade80"] },
  { value: "system", stripes: ["#ffffff", "#1f1f1f", "#4ade80"] },
];

/**
 * Theme choice with previews.
 *
 * Applying it is instant and local (`next-themes`); saving it is what makes the
 * choice follow the account to another browser.
 */
export function ThemePicker() {
  const { theme, setTheme } = useTheme();
  // `next-themes` only knows the stored value in the browser.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  async function choose(next: ThemePreference) {
    setTheme(next);
    const result = await updateSettingsAction({ theme: next });
    if (!result.ok) {
      toast.error("Couldn't save the theme", { description: result.error });
    }
  }

  return (
    <div className="grid grid-cols-3 gap-2">
      {CHOICES.map(({ value, stripes }) => {
        const active = mounted && theme === value;
        return (
          <button
            key={value}
            type="button"
            aria-pressed={active}
            aria-label={`${THEME_LABELS[value]} theme`}
            onClick={() => void choose(value)}
            className={cn(
              "group flex flex-col gap-2 rounded-lg border border-border p-2 text-left transition-colors hover:bg-accent",
              active && "border-primary bg-accent",
            )}
          >
            <span
              aria-hidden="true"
              className="flex h-10 w-full overflow-hidden rounded border border-border"
            >
              {stripes.map((color) => (
                <span key={color} className="h-full flex-1" style={{ backgroundColor: color }} />
              ))}
            </span>

            <span className="flex items-center gap-1.5">
              <span className="text-xs font-medium">{THEME_LABELS[value]}</span>
              {active ? (
                <Check className="ml-auto h-3.5 w-3.5 text-primary" aria-hidden="true" />
              ) : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}
