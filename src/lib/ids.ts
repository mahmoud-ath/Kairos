/**
 * Identifiers.
 *
 * Most ids in Kairos are ordinary strings, and a function that takes `(userId,
 * categoryId)` can be called with the arguments the wrong way round — TypeScript
 * accepts it, and the mistake only shows up as an empty list or, worse, as a
 * query that silently matches somebody else's row once tenancy is involved.
 *
 * `UserId` is a branded string: still a string at runtime (no wrappers, no
 * serialisation cost), but not interchangeable with any other string. The brand
 * is applied exactly once, where the session is read — see
 * `server/context.ts`. Pure modules keep taking plain strings, because they never
 * touch a tenant query.
 */

export type UserId = string & { readonly __brand: "UserId" };

/**
 * Brand a user id read from a trusted source (the session, never request input).
 *
 * Refuses an empty value: `scopedPrisma` fails closed on an empty owner, and a
 * brand that can hold `""` would only move that failure further away from the
 * cause.
 */
export function asUserId(value: string): UserId {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error("asUserId() was called with an empty value. Refusing to brand it.");
  }
  return trimmed as UserId;
}
