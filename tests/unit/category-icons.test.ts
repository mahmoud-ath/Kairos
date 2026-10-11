import { describe, expect, it } from "vitest";
import { Folder, Star } from "lucide-react";

import {
  CATEGORY_ICONS,
  CATEGORY_ICON_NAMES,
  categoryIcon,
  DEFAULT_CATEGORY_ICON,
  isCategoryIconName,
} from "@/lib/category-icons";

describe("category icons", () => {
  it("defaults to Folder", () => {
    expect(DEFAULT_CATEGORY_ICON).toBe("Folder");
    expect(CATEGORY_ICON_NAMES).toContain("Folder");
    expect(CATEGORY_ICONS.Folder).toBe(Folder);
  });

  it("resolves a stored name to its component", () => {
    expect(categoryIcon("Star")).toBe(Star);
  });

  it("falls back to Folder for unknown or missing names", () => {
    expect(categoryIcon(null)).toBe(Folder);
    expect(categoryIcon(undefined)).toBe(Folder);
    expect(categoryIcon("NotAnIcon")).toBe(Folder);
  });

  it("validates icon names", () => {
    expect(isCategoryIconName("Star")).toBe(true);
    expect(isCategoryIconName("NotAnIcon")).toBe(false);
    expect(isCategoryIconName(42)).toBe(false);
  });

  it("exposes a non-empty, unique catalogue", () => {
    expect(CATEGORY_ICON_NAMES.length).toBeGreaterThanOrEqual(20);
    expect(new Set(CATEGORY_ICON_NAMES).size).toBe(CATEGORY_ICON_NAMES.length);
  });
});
