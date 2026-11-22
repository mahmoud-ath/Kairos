/**
 * Category identity — including "no category".
 *
 * A task can have no category. That is what deleting its category leaves
 * behind, and what the "No category" option in the pickers produces. Leaving
 * that as an anonymous `null` means the same absence is special-cased in every
 * layer that groups or filters: the sidebar counters skip it, statistics invents
 * a row for it, and a filter cannot ask for it at all.
 *
 * So "no category" gets an id of its own: `UNCATEGORIZED_ID`. It is **not** a
 * row in the database and never can be one — a cuid is alphanumeric, so a value
 * containing underscores cannot collide with a real category id. It is the key
 * the rest of the app uses to mean *the bucket of tasks whose category is null*,
 * which is what makes "no category" filterable, countable and renderable exactly
 * like any other category.
 *
 * This is deliberately a key, not a migration: the data stays honest (a deleted
 * category really is absent, it is not silently replaced by a hidden row), while
 * every read path gets one stable answer to "which category is this?".
 */

import { UNCATEGORIZED_LABEL } from "@/lib/constants";

/** Key for tasks with no category. Never a real category id (see above). */
export const UNCATEGORIZED_ID = "__uncategorized__";

/** Neutral colour, so the bucket reads as "no category" rather than as a brand. */
export const UNCATEGORIZED_COLOR = "#94a3b8";

/**
 * The category key for a task: its own id, or the bucket it lands in.
 *
 * One function rather than `task.categoryId ?? ...` scattered around, so the
 * sentinel can never drift between the counters, the filter and statistics.
 */
export function categoryKey(categoryId: string | null | undefined): string {
  return categoryId ?? UNCATEGORIZED_ID;
}

/** True when this key is the no-category bucket. */
export function isUncategorizedKey(key: string | null | undefined): boolean {
  return key === UNCATEGORIZED_ID;
}

/** True when a task itself has no category. */
export function isUncategorized(categoryId: string | null | undefined): boolean {
  return categoryId === null || categoryId === undefined;
}

/**
 * Human label for a filter value.
 *
 * `null` means "every category" and has no row of its own, so it returns `null`
 * and callers fall back to their own wording ("All tasks").
 */
export function categoryFilterLabel(
  categoryId: string | null,
  categories: readonly { id: string; name: string }[],
): string | null {
  if (categoryId === null) return null;
  if (isUncategorizedKey(categoryId)) return UNCATEGORIZED_LABEL;
  return categories.find((category) => category.id === categoryId)?.name ?? null;
}

/* -------------------------------------------------------------------------- */
/* Readable URLs                                                             */
/* -------------------------------------------------------------------------- */

/** Longest slug we generate; well under any practical URL limit. */
export const CATEGORY_SLUG_MAX_LENGTH = 40;

/**
 * A URL-friendly form of a category name: "Work & Money" → "work-money".
 *
 * This is presentation, not identity — the database id stays the real key, so
 * renaming a category only changes its link and never breaks the data. Names
 * that slugify to nothing (emoji only, "!!!") fall back to "category".
 */
export function categorySlug(name: string): string {
  const slug = name
    .normalize("NFKD")
    // Drop the combining marks NFKD split off, so "Café" → "cafe".
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, CATEGORY_SLUG_MAX_LENGTH)
    .replace(/-+$/g, "");
  return slug || "category";
}

/**
 * Unique slugs for every category of one account, keyed by id.
 *
 * Two names can slugify to the same text ("Work" and "Work!"), and category
 * names are only unique verbatim. A list in display order therefore resolves
 * collisions deterministically: the first keeps the bare slug, the next become
 * `work-2`, `work-3`, … Both the links and the route resolver use this, so they
 * can never disagree.
 */
export function categorySlugMap(
  categories: readonly { id: string; name: string }[],
): Map<string, string> {
  const used = new Set<string>();
  const slugs = new Map<string, string>();

  for (const category of categories) {
    const base = categorySlug(category.name);
    let candidate = base;
    let suffix = 2;
    while (used.has(candidate)) {
      candidate = `${base}-${suffix}`;
      suffix += 1;
    }
    used.add(candidate);
    slugs.set(category.id, candidate);
  }

  return slugs;
}

/** The path a category's view lives at. */
export function categoryPath(slug: string): string {
  return `/categories/${encodeURIComponent(slug)}`;
}
