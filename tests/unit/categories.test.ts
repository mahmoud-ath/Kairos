import { describe, expect, it } from "vitest";

import {
  categoryFilterLabel,
  categoryKey,
  categoryPath,
  categorySlug,
  categorySlugMap,
  CATEGORY_SLUG_MAX_LENGTH,
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

describe("category slugs", () => {
  it("turns a name into a readable, url-safe segment", () => {
    expect(categorySlug("Work")).toBe("work");
    expect(categorySlug("Work & Money")).toBe("work-money");
    expect(categorySlug("  Deep   Work  ")).toBe("deep-work");
    expect(categorySlug("Café")).toBe("cafe");
    expect(categorySlug("Q4 / 2026 planning")).toBe("q4-2026-planning");
  });

  it("never returns an empty or trailing-dash segment", () => {
    expect(categorySlug("!!!")).toBe("category");
    expect(categorySlug("")).toBe("category");
    expect(categorySlug("Work!")).toBe("work");
  });

  it("caps the length", () => {
    const slug = categorySlug("word ".repeat(30));
    expect(slug.length).toBeLessThanOrEqual(CATEGORY_SLUG_MAX_LENGTH);
    expect(slug.endsWith("-")).toBe(false);
  });

  it("keeps the first name's slug and numbers the collisions", () => {
    const slugs = categorySlugMap([
      { id: "cat-1", name: "Work" },
      { id: "cat-2", name: "Work!" },
      { id: "cat-3", name: "work" },
      { id: "cat-4", name: "Home" },
    ]);

    expect(slugs.get("cat-1")).toBe("work");
    expect(slugs.get("cat-2")).toBe("work-2");
    expect(slugs.get("cat-3")).toBe("work-3");
    expect(slugs.get("cat-4")).toBe("home");
    // Every slug is unique, so a URL can only ever mean one category.
    expect(new Set(slugs.values()).size).toBe(4);
  });

  it("builds the path a link points at", () => {
    expect(categoryPath("deep-work")).toBe("/categories/deep-work");
  });
});
