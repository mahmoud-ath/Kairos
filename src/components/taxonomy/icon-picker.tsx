"use client";

import { CATEGORY_ICONS, CATEGORY_ICON_NAMES } from "@/lib/category-icons";
import { cn } from "@/lib/utils";

/**
 * Icon chooser for a category.
 *
 * A scrollable grid of the whole catalogue (see `src/lib/category-icons.ts`).
 * Colours are not shown here — a category's colour is picked separately and the
 * icon inherits it once saved.
 */
export function IconPicker({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (name: string) => void;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Icon"
      className={cn(
        "grid max-h-36 grid-cols-8 gap-1 overflow-y-auto rounded-md border border-border p-1.5 sm:grid-cols-10",
        className,
      )}
    >
      {CATEGORY_ICON_NAMES.map((name) => {
        const Icon = CATEGORY_ICONS[name];
        const active = name === value;
        return (
          <button
            key={name}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={name}
            title={name}
            onClick={() => onChange(name)}
            className={cn(
              "grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
              active && "bg-primary/10 text-primary ring-1 ring-primary/40",
            )}
          >
            <Icon className="h-4 w-4" />
          </button>
        );
      })}
    </div>
  );
}
