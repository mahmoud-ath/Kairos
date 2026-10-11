"use client";

import { useState } from "react";
import { toast } from "sonner";

import {
  FONT_SCALES,
  FONT_SCALE_KEYS,
  FONT_SCALE_LABELS,
} from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { FontScale } from "@/types/kairos";
import { updateSettingsAction } from "@/server/actions/settings";

/** Preview size for the "Aa" glyph: 12px at Compact, +1px per step. */
function previewSize(scale: FontScale): number {
  return 12 + (FONT_SCALES[scale] - FONT_SCALES.compact) / 12.5;
}

/**
 * Text-size choice.
 *
 * Applying it is instant and global (the root font size); saving it is what
 * makes the choice follow the account into another browser.
 */
export function FontScalePicker({ value }: { value: FontScale }) {
  const [current, setCurrent] = useState<FontScale>(value);

  async function choose(next: FontScale) {
    setCurrent(next);
    document.documentElement.style.fontSize = `${FONT_SCALES[next]}%`;

    const result = await updateSettingsAction({ fontScale: next });
    if (!result.ok) {
      toast.error("Couldn't save the text size", { description: result.error });
    }
  }

  return (
    <div role="radiogroup" aria-label="Text size" className="grid grid-cols-4 gap-2">
      {FONT_SCALE_KEYS.map((scale) => {
        const active = current === scale;
        return (
          <button
            key={scale}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={FONT_SCALE_LABELS[scale]}
            onClick={() => void choose(scale)}
            className={cn(
              "flex flex-col items-center gap-1 rounded-lg border border-border py-2 transition-colors hover:bg-accent",
              active && "border-primary bg-accent",
            )}
          >
            <span
              aria-hidden="true"
              className="font-semibold leading-none"
              style={{ fontSize: `${previewSize(scale)}px` }}
            >
              Aa
            </span>
            <span className="text-[11px] text-muted-foreground">
              {FONT_SCALE_LABELS[scale]}
            </span>
          </button>
        );
      })}
    </div>
  );
}
