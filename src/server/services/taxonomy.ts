import "server-only";

import { CATEGORY_COLORS } from "@/lib/constants";
import type { CategoryDTO, LabelDTO } from "@/types/kairos";
import { prisma, type Prisma } from "@/server/db";
import { serializeLabel } from "@/server/serializers";

/* -------------------------------------------------------------------------- */
/* Categories                                                                 */
/* -------------------------------------------------------------------------- */

/** Categories in display order, with the number of unfinished tasks each holds. */
export async function listCategories(): Promise<CategoryDTO[]> {
  const [categories, counts] = await Promise.all([
    prisma.category.findMany({ orderBy: [{ position: "asc" }, { name: "asc" }] }),
    prisma.task.groupBy({
      by: ["categoryId"],
      where: { parentId: null, status: "TODO", categoryId: { not: null } },
      _count: { _all: true },
    }),
  ]);

  const countByCategory = new Map<string, number>();
  for (const row of counts) {
    if (row.categoryId) countByCategory.set(row.categoryId, row._count._all);
  }

  return categories.map((category) => ({
    id: category.id,
    name: category.name,
    color: category.color,
    position: category.position,
    openTaskCount: countByCategory.get(category.id) ?? 0,
  }));
}

export async function getCategory(id: string) {
  return prisma.category.findUnique({ where: { id } });
}

export async function createCategory(values: { name: string; color?: string }) {
  const last = await prisma.category.findFirst({ orderBy: { position: "desc" } });
  const position = last ? last.position + 1 : 0;
  const color =
    values.color ?? CATEGORY_COLORS[(position + CATEGORY_COLORS.length) % CATEGORY_COLORS.length];

  return prisma.category.create({
    data: { name: values.name, color, position },
  });
}

export async function updateCategory(values: {
  id: string;
  name?: string;
  color?: string;
  position?: number;
}) {
  const data: Prisma.CategoryUpdateInput = {};
  if (values.name !== undefined) data.name = values.name;
  if (values.color !== undefined) data.color = values.color;
  if (values.position !== undefined) data.position = values.position;

  return prisma.category.update({ where: { id: values.id }, data });
}

/**
 * Delete a category. Tasks are kept: `onDelete: SetNull` moves them to
 * Uncategorized (their labels and events are untouched).
 */
export async function deleteCategory(id: string) {
  const affected = await prisma.task.count({ where: { categoryId: id } });
  await prisma.category.delete({ where: { id } });
  return { movedTasks: affected };
}

/** Persist a new category order in one transaction. */
export async function reorderCategories(orderedIds: readonly string[]) {
  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.category.update({ where: { id }, data: { position: index } }),
    ),
  );
}

/* -------------------------------------------------------------------------- */
/* Labels                                                                     */
/* -------------------------------------------------------------------------- */

export async function listLabels(): Promise<LabelDTO[]> {
  const labels = await prisma.label.findMany({ orderBy: [{ name: "asc" }] });
  return labels.map(serializeLabel);
}

export async function createLabel(values: { name: string; color?: string }) {
  const count = await prisma.label.count();
  const color =
    values.color ?? CATEGORY_COLORS[(count + 5) % CATEGORY_COLORS.length];
  return prisma.label.create({ data: { name: values.name, color } });
}

export async function updateLabel(values: { id: string; name?: string; color?: string }) {
  const data: Prisma.LabelUpdateInput = {};
  if (values.name !== undefined) data.name = values.name;
  if (values.color !== undefined) data.color = values.color;
  return prisma.label.update({ where: { id: values.id }, data });
}

/** Deleting a label removes its assignments; tasks themselves are untouched. */
export async function deleteLabel(id: string) {
  await prisma.label.delete({ where: { id } });
}

export async function setTaskLabels(
  db: Prisma.TransactionClient,
  taskId: string,
  labelIds: readonly string[],
) {
  await db.taskLabel.deleteMany({ where: { taskId } });
  if (labelIds.length === 0) return;
  await db.taskLabel.createMany({
    data: labelIds.map((labelId) => ({ taskId, labelId })),
  });
}
