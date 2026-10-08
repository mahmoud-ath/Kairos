"use server";

import { z } from "zod";

import {
  createCategorySchema,
  idSchema,
  updateCategorySchema,
} from "@/lib/validation";
import type { ActionResult, CategoryDTO } from "@/types/kairos";
import { requireUserId } from "@/server/auth";
import { runAction } from "@/server/actions/helpers";
import {
  createCategory,
  deleteCategory,
  reorderCategories,
  updateCategory,
} from "@/server/services/taxonomy";

export async function createCategoryAction(
  input: unknown,
): Promise<ActionResult<CategoryDTO>> {
  return runAction(async () => {
    const userId = await requireUserId();
    const values = createCategorySchema.parse(input);
    const category = await createCategory(userId, values);
    return { ...category, openTaskCount: 0 };
  });
}

export async function updateCategoryAction(
  input: unknown,
): Promise<ActionResult<CategoryDTO>> {
  return runAction(async () => {
    const userId = await requireUserId();
    const values = updateCategorySchema.parse(input);
    const category = await updateCategory(userId, values);
    return { ...category, openTaskCount: 0 };
  });
}

/** Deleting a category moves its tasks to Uncategorized. */
export async function deleteCategoryAction(
  input: unknown,
): Promise<ActionResult<{ movedTasks: number }>> {
  return runAction(async () => {
    const userId = await requireUserId();
    const { id } = z.object({ id: idSchema }).parse(input);
    return deleteCategory(userId, id);
  });
}

export async function reorderCategoriesAction(
  input: unknown,
): Promise<ActionResult<undefined>> {
  return runAction(async () => {
    const userId = await requireUserId();
    const { ids } = z.object({ ids: z.array(idSchema).max(200) }).parse(input);
    await reorderCategories(userId, ids);
    return undefined;
  });
}
