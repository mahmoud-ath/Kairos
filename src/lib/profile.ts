/**
 * How an account is named in the UI.
 *
 * Pure helpers shared by the top bar, the settings panel and the tests.
 */

import { DEFAULT_NICKNAME } from "@/lib/constants";

/** "ada.lovelace@example.com" → "Ada". */
function nameFromEmail(email: string | null | undefined): string | null {
  const local = email?.split("@")[0];
  if (!local) return null;
  const token = local.split(/[._\-+]+/).filter(Boolean)[0];
  if (!token) return null;
  return token.charAt(0).toUpperCase() + token.slice(1);
}

/**
 * The greeting name: the chosen nickname if there is one, otherwise a name
 * derived from the email address, otherwise a friendly default.
 */
export function displayName(
  nickname: string | null | undefined,
  email: string | null | undefined,
): string {
  const chosen = nickname?.trim();
  if (chosen) return chosen;
  return nameFromEmail(email) ?? DEFAULT_NICKNAME;
}

/** Up to two initials for the avatar placeholder: "Ada Lovelace" → "AL". */
export function initialsFor(
  nickname: string | null | undefined,
  email: string | null | undefined,
): string {
  const source = nickname?.trim() || email?.split("@")[0] || "";
  const parts = source.split(/[\s._\-+]+/).filter(Boolean);
  if (parts.length === 0) return "K";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}
