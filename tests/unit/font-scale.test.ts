import { describe, expect, it } from "vitest";

import {
  DEFAULT_FONT_SCALE,
  FONT_SCALES,
  FONT_SCALE_KEYS,
  FONT_SCALE_LABELS,
} from "@/lib/constants";

describe("text size", () => {
  it("offers four scales in ascending order", () => {
    expect(FONT_SCALE_KEYS).toEqual(["compact", "default", "large", "larger"]);

    const sizes = FONT_SCALE_KEYS.map((key) => FONT_SCALES[key]);
    expect(sizes).toEqual([...sizes].sort((a, b) => a - b));
    expect(new Set(sizes).size).toBe(sizes.length);
  });

  it("has a label for every scale", () => {
    for (const key of FONT_SCALE_KEYS) {
      expect(FONT_SCALE_LABELS[key]).toBeTruthy();
    }
  });

  it("defaults to the size globals.css already uses", () => {
    expect(DEFAULT_FONT_SCALE).toBe("default");
    // Keep in step with `html { font-size: … }` in src/app/globals.css.
    expect(FONT_SCALES.default).toBe(112.5);
  });
});
