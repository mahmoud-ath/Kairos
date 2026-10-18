import { timingSafeEqual } from "node:crypto";

/**
 * Authentication for the scheduled daily broadcast.
 *
 * The cron route is reachable without a session — a scheduler has no browser and
 * no login — so the shared secret *is* the authentication. Two consequences:
 *
 * 1. **It fails closed.** With no secret configured nothing is authorized, so a
 *    forgotten variable cannot turn the endpoint into an open "send a push to
 *    every subscriber" button.
 * 2. **It compares in constant time.** A comparison that returns as soon as two
 *    strings differ leaks the secret one character at a time to anyone who can
 *    measure the response.
 *
 * Deliberately not importing `server-only`: this is a small pure function, and
 * keeping it importable is what lets the unit suite test it directly.
 */

const BEARER_PATTERN = /^Bearer\s+(.+)$/i;

/**
 * The configured secret.
 *
 * `KAIROS_CRON_SECRET` is the documented name. Vercel's own convention is
 * `CRON_SECRET`, and it only attaches the `Authorization` header automatically
 * under that exact name — so on Vercel that one is accepted too, rather than
 * making the deployment depend on a rename.
 */
export function schedulerSecret(): string {
  return (process.env.KAIROS_CRON_SECRET ?? process.env.CRON_SECRET ?? "").trim();
}

/**
 * True when the `Authorization` header carries the scheduler secret.
 *
 * Surrounding whitespace is ignored, which mirrors the transport: HTTP strips
 * optional whitespace around a header value before it ever reaches this function.
 */
export function isAuthorizedScheduler(
  authorization: string | null | undefined,
  expected: string = schedulerSecret(),
): boolean {
  if (!expected) return false;
  if (typeof authorization !== "string") return false;

  const match = BEARER_PATTERN.exec(authorization.trim());
  if (!match) return false;

  const provided = Buffer.from(match[1], "utf8");
  const wanted = Buffer.from(expected, "utf8");
  if (provided.length !== wanted.length) return false;
  return timingSafeEqual(provided, wanted);
}
