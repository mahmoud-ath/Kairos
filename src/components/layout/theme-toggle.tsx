"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { THEME_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { ThemePreference } from "@/types/kairos";

const OPTIONS: { value: ThemePreference; Icon: typeof Sun }[] = [
  { value: "light", Icon: Sun },
  { value: "dark", Icon: Moon },
  { value: "system", Icon: Monitor },
];

/** One control, three places: site header, sidebar, and the settings profile. */
export type ThemeToggleProps = {
  className?: string;
  /**
   * Called *after* the theme has been applied. Used to persist the choice
   * (`updateSettingsAction`) — the toggle itself never talks to the server, so
   * it can also live on pages nobody is signed in to.
   */
  onChange?: (theme: ThemePreference) => void;
};

/**
 * `next-themes` resolves the stored theme in the browser, so it is unknown while
 * the markup is rendered on the server. Reporting "nothing selected" until after
 * mount avoids a hydration mismatch (and the console error that comes with it).
 */
function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

/** Light / dark / system as three icon buttons. */
export function ThemeToggle({ className, onChange }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();

  return (
    <div
      className={cn(
        "flex items-center gap-0.5 rounded-md border border-border p-0.5",
        className,
      )}
    >
      {OPTIONS.map(({ value, Icon }) => {
        const active = mounted && theme === value;
        return (
          <Tooltip key={value}>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label={`${THEME_LABELS[value]} theme`}
                aria-pressed={active}
                onClick={() => {
                  setTheme(value);
                  onChange?.(value);
                }}
                className={cn(
                  "grid h-7 w-7 place-items-center rounded text-muted-foreground transition-all hover:bg-accent hover:text-foreground",
                  active && "bg-accent text-foreground",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent>{THEME_LABELS[value]}</TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}
