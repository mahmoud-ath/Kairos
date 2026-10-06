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
 * Kairos v1 has no user model — the database is single-user. Supabase Auth is
 * therefore an *access gate*, not multi-tenancy: it decides whether a request
 * may touch the one shared workspace.
 *
 * The gate is deliberately inert when Supabase is not configured, so local
 * development, the Playwright suite and private self-hosted deployments keep
 * working without credentials. `KAIROS_AUTH_DISABLED=true` forces the same
 * behaviour explicitly (see DEPLOYMENT.md §10.9).
 */
export function isAuthDisabled(): boolean {
  return process.env.KAIROS_AUTH_DISABLED === "true" || !isSupabaseConfigured();
}

/** The signed-in user, or `null` when the gate is inert or nobody is signed in. */
export async function getCurrentUser(): Promise<User | null> {
  if (isAuthDisabled()) return null;

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
