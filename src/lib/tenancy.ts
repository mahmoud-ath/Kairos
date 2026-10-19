/**
 * Which models belong to exactly one user.
 *
 * `scopedPrisma` only injects an owner filter into models listed here, so a
 * model that gains a `userId` column but is forgotten in this list would be
 * readable across accounts. The list therefore lives in a plain module that a
 * unit test can import, and `tests/unit/tenancy.test.ts` compares it against
 * `prisma/schema.prisma` in **both** directions:
 *
 * - every model with a `userId` column must be listed, and
 * - every listed model must actually have one.
 *
 * Adding a tenant model to the schema without adding it here (or vice versa) now
 * fails the suite instead of leaking data.
 */

export const TENANT_MODEL_NAMES = [
  "Task",
  "Category",
  "TaskEvent",
  "Settings",
  "Habit",
  "PushSubscription",
] as const;

export type TenantModelName = (typeof TENANT_MODEL_NAMES)[number];

const TENANT_MODELS: ReadonlySet<string> = new Set(TENANT_MODEL_NAMES);

/** True when rows of this Prisma model belong to one user. */
export function isTenantModel(model: string): boolean {
  return TENANT_MODELS.has(model);
}
