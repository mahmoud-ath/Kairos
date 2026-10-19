import "server-only";

import { cache } from "react";

import { buildRequestContext, type RequestContext } from "@/lib/request-context";
import { requireAuthProfile } from "@/server/auth";
import { getSettingsRecord } from "@/server/services/settings";

/**
 * Everything a request needs to know about *who* is asking, computed once.
 *
 * Before this, every page and every habit action fetched the settings record and
 * derived "today" from the account's timezone itself. That is duplicated work,
 * and — worse — a chance for two parts of one render to disagree about which day
 * it is (a request that starts at 23:59:59 in Casablanca can straddle midnight if
 * each layer computes it separately).
 *
 * So the account's clock is read **once per request**: `getRequestContext()` is
 * wrapped in React's `cache`, which memoises for the duration of one request. Two
 * calls in one render — a layout and the page below it — cost one settings read
 * and return the same `today`.
 *
 * **Not** a module-level variable: Vercel reuses a serverless instance for
 * different users in sequence, so "the current user" stored at module scope would
 * hand one account's workspace to the next request. The context lives on the
 * request, and the only way to obtain one is through the session.
 *
 * The shape and the derivation are pure and live in `lib/request-context.ts`,
 * where they are unit-tested; this file owns the session plumbing only.
 */

export type { RequestContext };

/**
 * The context for the current request.
 *
 * Memoised by React per request; safe to call from any Server Component, page or
 * Server Action.
 */
export const getRequestContext = cache(async (): Promise<RequestContext> => {
  const { userId, email } = await requireAuthProfile();
  const settings = await getSettingsRecord(userId);
  return buildRequestContext({ userId, email, settings });
});
