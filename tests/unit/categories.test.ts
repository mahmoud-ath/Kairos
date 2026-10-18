import { describe, expect, it } from "vitest";

import {
  categoryFilterLabel,
  categoryKey,
  isUncategorized,
  isUncategorizedKey,
  UNCATEGORIZED_ID,
} from "@/lib/categories";
import { UNCATEGORIZED_LABEL } from "@/lib/constants";

describe("the category key", () => {
  it("is the task's own category when it has one", () => {
    expect(categoryKey("cat-1")).toBe("cat-1");
  });

  it("turns an absent category into a key of its own", () => {
    expect(categoryKey(null)).toBe(UNCATEGORIZED_ID);
    expect(categoryKey(undefined)).toBe(UNCATEGORIZED_ID);
  });

  it("cannot collide with a real category id", () => {
    // Prisma ids are cuids: lowercase alphanumerics, so underscores rule out a clash.
    expect(UNCATEGORIZED_ID).toContain("_");
    expect(UNCATEGORIZED_ID).not.toMatch(/^[a-z0-9]+$/);
  });

  it("recognises the bucket in both directions", () => {
    expect(isUncategorizedKey(UNCATEGORIZED_ID)).toBe(true);
    expect(isUncategorizedKey("cat-1")).toBe(false);
    expect(isUncategorized(null)).toBe(true);
    expect(isUncategorized("cat-1")).toBe(false);
  });
});

describe("the category filter label", () => {
  const categories = [
    { id: "cat-1", name: "Work" },
    { id: "cat-2", name: "Home" },
  ];

  it("names a real category", () => {
    expect(categoryFilterLabel("cat-2", categories)).toBe("Home");
  });

  it("names the bucket rather than leaving it blank", () => {
    expect(categoryFilterLabel(UNCATEGORIZED_ID, categories)).toBe(UNCATEGORIZED_LABEL);
  });

  it("has no label for \\u201cevery category\\u201d", () => {
    expect(categoryFilterLabel(null, categories)).toBeNull();
  });

  it("returns null for a category that no longer exists", () => {
    expect(categoryFilterLabel("deleted-id", categories)).toBeNull();
  });
});
