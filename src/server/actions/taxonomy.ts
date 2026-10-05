"use server";

import {
  createCategorySchema,
  createLabelSchema,
  idSchema,
  updateCategorySchema,
  updateLabelSchema,
} from "@/lib/validation";
import { z } from "zod";

import type { ActionResult, CategoryDTO, LabelDTO } from "@/types/kairos";
import { runAction } from "@/server/actions/helpers";
import {
  createCategory,
  createLabel,
  deleteCategory,
  deleteLabel,
  reorderCategories,
  updateCategory,
  updateLabel,
} from "@/server/services/taxonomy";

export async function createCategoryAction(
  input: unknown,
): Promise<ActionResult<CategoryDTO>> {
  return runAction(async () => {
    const values = createCategorySchema.parse(input);
    const category = await createCategory(values);
    return { ...category, openTaskCount: 0 };
  });
}

export async function updateCategoryAction(
  input: unknown,
): Promise<ActionResult<CategoryDTO>> {
  return runAction(async () => {
    const values = updateCategorySchema.parse(input);
    const category = await updateCategory(values);
    return { ...category, openTaskCount: 0 };
  });
}

/** Deleting a category moves its tasks to Uncategorized. */
export async function deleteCategoryAction(
  input: unknown,
): Promise<ActionResult<{ movedTasks: number }>> {
  return runAction(async () => {
    const { id } = z.object({ id: idSchema }).parse(input);
    return deleteCategory(id);
  });
}

export async function reorderCategoriesAction(
  input: unknown,
): Promise<ActionResult<undefined>> {
  return runAction(async () => {
    const { ids } = z.object({ ids: z.array(idSchema).max(200) }).parse(input);
    await reorderCategories(ids);
    return undefined;
  });
}

export async function createLabelAction(input: unknown): Promise<ActionResult<LabelDTO>> {
  return runAction(async () => {
    const values = createLabelSchema.parse(input);
    const label = await createLabel(values);
    return { id: label.id, name: label.name, color: label.color };
  });
}

export async function updateLabelAction(input: unknown): Promise<ActionResult<LabelDTO>> {
  return runAction(async () => {
    const values = updateLabelSchema.parse(input);
    const label = await updateLabel(values);
    return { id: label.id, name: label.name, color: label.color };
  });
}

/** Deleting a label removes its assignments; tasks are not deleted. */
export async function deleteLabelAction(input: unknown): Promise<ActionResult<undefined>> {
  return runAction(async () => {
    const { id } = z.object({ id: idSchema }).parse(input);
    await deleteLabel(id);
    return undefined;
  });
}
