/**
 * The request context: who is asking, and what day it is for them.
 *
 * Kept here rather than in `server/context.ts` so the *rule* — today is derived
 * from the account's timezone, and the owner id is branded — is a pure function
 * that can be unit-tested. The server module owns the impure half: reading the
 * session and the settings row, once per request.
 */

import { todayDateOnly } from "@/lib/dates";
import { asUserId, type UserId } from "@/lib/ids";
import type { SettingsRecord } from "@/types/kairos";

export type RequestContext = {
  readonly userId: UserId;
  readonly email: string | null;
  readonly settings: SettingsRecord;
  /** The account's timezone, as stored in Settings → Dates. */
  readonly timeZone: string;
  /**
   * Today's date-only value (`YYYY-MM-DD`) **in that timezone**.
   *
   * Every service that asks "is this due today" or "is this day in the past" must
   * use this value rather than the server's clock, which is UTC on Vercel.
   */
  readonly today: string;
};

/**
 * Build a context from already-loaded pieces.
 *
 * `now` is injectable so the derivation can be tested at a fixed instant — the
 * timezone boundary is the whole point of the value, and a test that depends on
 * when it runs proves nothing.
 */
export function buildRequestContext(input: {
  userId: string;
  email: string | null;
  settings: SettingsRecord;
  now?: Date;
}): RequestContext {
  return {
    userId: asUserId(input.userId),
    email: input.email,
    settings: input.settings,
    timeZone: input.settings.timezone,
    today: todayDateOnly(input.settings.timezone, input.now),
  };
}
