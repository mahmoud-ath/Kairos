/**
 * Email allowlist rules.
 *
 * Pure and dependency-free on purpose: the middleware runs in the edge runtime
 * and cannot import `next/headers`, but it must apply exactly the same rule as
 * the server-side guard in `src/server/auth.ts`.
 *
 * `KAIROS_ALLOWED_EMAILS` is a comma-separated list. Leaving it empty means
 * "any user that exists in the Supabase project" — see DEPLOYMENT.md §10.9.
 */
export function allowedEmails(): string[] {
  return (process.env.KAIROS_ALLOWED_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isEmailAllowed(email: string | null | undefined): boolean {
  const allowed = allowedEmails();
  if (allowed.length === 0) return true;
  if (!email) return false;
  return allowed.includes(email.toLowerCase());
}

/**
 * Where to send somebody after signing in.
 *
 * Only a path on this app is ever accepted — never an absolute URL, and never a
 * protocol-relative `//host` — so a crafted `?next=` cannot turn the sign-in page
 * into an open redirect.
 */
export function safeNextPath(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/today";
  return value;
}
