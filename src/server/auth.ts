import "server-only";

import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";

import { isEmailAllowed } from "@/lib/auth-rules";
import {
  createSupabaseServerClient,
  isSupabaseConfigured,
} from "@/lib/supabase/server";

/**
 * The authentication gate.
 *
 * Every account owns a private slice of the database, so the gate is what keeps
 * one user's tasks out of another's. It is not optional infrastructure.
 *
 * It is therefore **on by default and fails closed**: if the Supabase project is
 * not configured, requests are refused rather than quietly served from one
 * shared workspace. `KAIROS_AUTH_DISABLED=true` is the only way to switch it
 * off, and it exists for local development and the Playwright suite — never for
 * anything reachable from the internet.
 */
export function isAuthDisabled(): boolean {
  return process.env.KAIROS_AUTH_DISABLED === "true";
}

/**
 * Refuse to serve when the gate is on but the project is unconfigured.
 *
 * The alternative — treating every visitor as the same user — is how a public
 * app ends up handing one person's tasks to the next person who signs in.
 */
function assertAuthConfigured(): void {
  if (!isSupabaseConfigured()) {
    throw new Error(
      "Authentication is enabled but Supabase is not configured. Set " +
        "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY " +
        "(docs/auth-setup.md), or set KAIROS_AUTH_DISABLED=true to run without " +
        "sign-in — local development only.",
    );
  }
}

/** The signed-in user, or `null` when the gate is inert or nobody is signed in. */
export async function getCurrentUser(): Promise<User | null> {
  if (isAuthDisabled()) return null;

  assertAuthConfigured();

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
}

/**
 * Require a signed-in, allowlisted user.
 *
 * Returns `null` when the gate is disabled. Otherwise redirects to `/login`,
 * preserving the requested path so the form can send the user back.
 */
export async function requireUser(): Promise<User | null> {
  if (isAuthDisabled()) return null;

  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (!isEmailAllowed(user.email)) {
    redirect("/login?error=not_allowed");
  }

  return user;
}

/**
 * The owner id used when the gate is switched off (`KAIROS_AUTH_DISABLED=true`:
 * local development, Playwright). Everything written then belongs to this one
 * pseudo-user, which is exactly the old single-user behaviour.
 */
export const LOCAL_USER_ID = "local";

/**
 * The current owner's id — the value every service filters by.
 *
 * This is the **only** place a tenant is established, and it always comes from
 * the verified session, never from a request body, query string or form field.
 * Callers cannot supply their own id.
 */
export async function requireUserId(): Promise<string> {
  if (isAuthDisabled()) return LOCAL_USER_ID;

  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (!isEmailAllowed(user.email)) {
    redirect("/login?error=not_allowed");
  }

  return user.id;
}
