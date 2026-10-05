import "server-only";

import { revalidatePath } from "next/cache";
import type { ZodError } from "zod";

import { firstErrorMessage, flattenZodError } from "@/lib/validation";
import type { ActionResult } from "@/types/kairos";
import { ServiceError } from "@/server/services/tasks";

/**
 * Refresh every app route after a mutation.
 *
 * Task data is mutable and shared between the page and the shell (sidebar
 * counters, progress panel), so nothing may be served from a stale cache.
 */
export function revalidateApp(): void {
  revalidatePath("/", "layout");
}

export function toActionError(error: unknown): ActionResult<never> {
  if (error instanceof ServiceError) {
    return { ok: false, error: error.message, fieldErrors: error.fieldErrors };
  }
  if (error && typeof error === "object" && "issues" in error) {
    const zodError = error as ZodError;
    return {
      ok: false,
      error: firstErrorMessage(zodError),
      fieldErrors: flattenZodError(zodError),
    };
  }
  console.error("[kairos] action failed", error);
  return { ok: false, error: "Something went wrong. Please try again." };
}

/** Run a validated mutation and normalize any failure into an ActionResult. */
export async function runAction<T>(
  fn: () => Promise<T>,
  options: { revalidate?: boolean } = {},
): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    if (options.revalidate !== false) revalidateApp();
    return { ok: true, data };
  } catch (error) {
    return toActionError(error);
  }
}

export function zodFieldErrors(error: ZodError) {
  return flattenZodError(error);
}
