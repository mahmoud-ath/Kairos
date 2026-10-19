import "server-only";

import { revalidatePath } from "next/cache";
import type { ZodError } from "zod";

import { firstErrorMessage, flattenZodError } from "@/lib/validation";
import { rateLimitMessage } from "@/lib/rate-limit";
import type { ActionResult } from "@/types/kairos";
import { ServiceError } from "@/server/errors";
import { consumeActionRateLimit } from "@/server/rate-limit";

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

/**
 * Run a validated mutation and normalize any failure into an ActionResult.
 *
 * This is the app's choke point: every write goes through it, which is why the
 * rate limiter lives here rather than on `/api/*` (there are three routes and
 * dozens of mutations — see docs/rate-limiting.md).
 *
 * `action` names the mutation for the limiter's bucket. It is optional: an
 * unlabelled action falls into the ordinary `mutation` bucket. Only the actions
 * that rewrite the whole workspace need to say who they are, because they spend
 * a much smaller budget.
 *
 * The limiter runs *before* `fn`, so a blocked caller never reaches Zod, the
 * database, or a service. It resolves the account itself, which is memoised per
 * request, so it does not add an auth round trip.
 */
export async function runAction<T>(
  fn: () => Promise<T>,
  options: { revalidate?: boolean; action?: string } = {},
): Promise<ActionResult<T>> {
  const limit = await consumeActionRateLimit(options.action ?? "mutation");
  if (!limit.allowed) {
    return {
      ok: false,
      error: rateLimitMessage(limit),
      retryAfterSeconds: limit.retryAfterSeconds,
    };
  }

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
