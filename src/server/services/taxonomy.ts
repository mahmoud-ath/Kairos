import "server-only";

import { cache } from "react";

import { categorySlug, categorySlugMap } from "@/lib/categories";
import { CATEGORY_COLORS } from "@/lib/constants";
import { DEFAULT_CATEGORY_ICON } from "@/lib/category-icons";
import type { CategoryDTO } from "@/types/kairos";
import { scopedPrisma, type Prisma } from "@/server/db";

/**
 * Categories are the only way Kairos groups tasks (there is no separate label
 * concept). A task has at most one category, and subtasks inherit theirs.
 *
 * Every function takes the owner's id and works through a client that cannot
 * see anybody else's rows (see `scopedPrisma`).
 */

/** Display order: the sidebar's, and the order slugs are disambiguated in. */
const CATEGORY_ORDER: Prisma.CategoryOrderByWithRelationInput[] = [
  { position: "asc" },
  { name: "asc" },
];

/** Categories in display order, with the number of unfinished tasks each holds. */
export const listCategories = cache(async (userId: string): Promise<CategoryDTO[]> => {
  const prisma = scopedPrisma(userId);
  const [categories, counts] = await Promise.all([
    prisma.category.findMany({ orderBy: CATEGORY_ORDER }),
    prisma.task.groupBy({
      by: ["categoryId"],
      // Generated habit instances belong to Today and are left out, so a
      // category's sidebar count matches what its view actually lists.
      where: {
        parentId: null,
        status: "TODO",
        categoryId: { not: null },
        habitId: null,
      },
      _count: { _all: true },
    }),
  ]);

  const countByCategory = new Map<string, number>();
  for (const row of counts) {
    if (row.categoryId) countByCategory.set(row.categoryId, row._count._all);
  }
  const slugs = categorySlugMap(categories);

  return categories.map((category) => ({
    id: category.id,
    name: category.name,
    color: category.color,
    icon: category.icon,
    position: category.position,
    slug: slugs.get(category.id) ?? categorySlug(category.name),
    openTaskCount: countByCategory.get(category.id) ?? 0,
  }));
});

/** The unique slug of one category, for the DTOs a mutation returns. */
export async function categorySlugFor(userId: string, id: string): Promise<string> {
  const prisma = scopedPrisma(userId);
  const categories = await prisma.category.findMany({
    select: { id: true, name: true },
    orderBy: CATEGORY_ORDER,
  });
  const slugs = categorySlugMap(categories);
  const match = categories.find((category) => category.id === id);
  return slugs.get(id) ?? (match ? categorySlug(match.name) : categorySlug(id));
}

/** A category row as stored (not the UI DTO). */
export type CategoryRow = {
  id: string;
  userId: string;
  name: string;
  color: string;
  icon: string;
  position: number;
  createdAt: Date;
};

/** One category with the slug its view lives at. */
export type ResolvedCategory = {
  category: CategoryRow;
  slug: string;
};

/**
 * Look up a category from the URL.
 *
 * Both forms work: the readable slug (`/categories/work`) and the legacy id
 * (`/categories/cmv05qmz…`), because links written before slugs existed are
 * still in browser histories and bookmarks. The canonical slug comes back either
 * way, so the page can advertise the pretty URL.
 */
export async function resolveCategory(
  userId: string,
  segment: string,
): Promise<ResolvedCategory | null> {
  let decoded = segment;
  try {
    decoded = decodeURIComponent(segment).trim();
  } catch {
    return null; // malformed escape in the URL
  }
  if (!decoded) return null;

  const prisma = scopedPrisma(userId);
  const rows = await prisma.category.findMany({ orderBy: CATEGORY_ORDER });
  const slugs = categorySlugMap(rows);

  const byId = rows.find((row) => row.id === decoded);
  if (byId) {
    return { category: byId, slug: slugs.get(byId.id) ?? categorySlug(byId.name) };
  }

  const wanted = decoded.toLowerCase();
  const bySlug = rows.find((row) => slugs.get(row.id) === wanted);
  if (!bySlug) return null;
  return { category: bySlug, slug: slugs.get(bySlug.id) ?? wanted };
}

export async function getCategory(userId: string, id: string) {
  const prisma = scopedPrisma(userId);
  return prisma.category.findUnique({ where: { id } });
}

export async function getCategoryByName(userId: string, name: string) {
  const prisma = scopedPrisma(userId);
  return prisma.category.findFirst({ where: { name } });
}

/** Create a category, appending it to the end of the sidebar order. */
export async function createCategory(
  userId: string,
  values: { name: string; color?: string; icon?: string },
) {
  const prisma = scopedPrisma(userId);
  const last = await prisma.category.findFirst({ orderBy: { position: "desc" } });
  const position = last ? last.position + 1 : 0;
  const color =
    values.color ?? CATEGORY_COLORS[position % CATEGORY_COLORS.length];

  return prisma.category.create({
    data: {
      userId,
      name: values.name,
      color,
      icon: values.icon ?? DEFAULT_CATEGORY_ICON,
      position,
    },
  });
}

export async function updateCategory(
  userId: string,
  values: {
    id: string;
    name?: string;
    color?: string;
    icon?: string;
    position?: number;
  },
) {
  const prisma = scopedPrisma(userId);
  const data: Prisma.CategoryUpdateInput = {};
  if (values.name !== undefined) data.name = values.name;
  if (values.color !== undefined) data.color = values.color;
  if (values.icon !== undefined) data.icon = values.icon;
  if (values.position !== undefined) data.position = values.position;

  return prisma.category.update({ where: { id: values.id }, data });
}

/**
 * Delete a category. Tasks are kept: `onDelete: SetNull` moves them to
 * Uncategorized. History and subtasks are untouched.
 */
export async function deleteCategory(userId: string, id: string) {
  const prisma = scopedPrisma(userId);
  const affected = await prisma.task.count({ where: { categoryId: id } });
  await prisma.category.delete({ where: { id } });
  return { movedTasks: affected };
}

/** Persist a new category order in one transaction. */
export async function reorderCategories(
  userId: string,
  orderedIds: readonly string[],
) {
  const prisma = scopedPrisma(userId);
  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.category.update({ where: { id }, data: { position: index } }),
    ),
  );
}
