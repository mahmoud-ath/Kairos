"use client";

import { CATEGORY_COLORS } from "@/lib/constants";
import { cn } from "@/lib/utils";

/** A small swatch grid used for categories and labels. */
export function ColorPicker({
  value,
  onChange,
  colors = CATEGORY_COLORS,
  label = "Color",
}: {
  value: string;
  onChange: (color: string) => void;
  colors?: readonly string[];
  label?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
      {colors.map((color) => {
        const active = color.toLowerCase() === value.toLowerCase();
        return (
          <button
            key={color}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={color}
            onClick={() => onChange(color)}
            className={cn(
              "h-6 w-6 rounded-full border border-black/10 transition-transform dark:border-white/15",
              active ? "ring-2 ring-ring ring-offset-2 ring-offset-background" : "hover:scale-105",
            )}
            style={{ backgroundColor: color }}
          />
        );
      })}
    </div>
  );
}
