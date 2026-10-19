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
 * Is this a hosted deployment rather than somebody's machine?
 *
 * Vercel sets `VERCEL=1` and `VERCEL_ENV` to `production`, `preview` or
 * `development`. **Preview counts as hosted**: preview URLs are reachable from the
 * internet and inherit the project's environment variables.
 *
 * `next dev` and `next start` on a laptop set neither, which is what keeps local
 * development and the Playwright suite working.
 */
export function isHostedDeployment(
  env: Record<string, string | undefined> = process.env,
): boolean {
  if (env.VERCEL === "1") return true;
  return env.VERCEL_ENV === "production" || env.VERCEL_ENV === "preview";
}

/**
 * Is the sign-in gate switched off?
 *
 * `KAIROS_AUTH_DISABLED=true` exists for local development and the Playwright
 * suite. It is **never honoured on a hosted deployment**: one stray variable would
 * turn every account's workspace into one shared workspace, visible to anybody who
 * loaded the site, and nothing else in the app could tell the difference.
 *
 * Pure and shared, because the middleware (edge runtime) and `server/auth.ts` (node)
 * must apply exactly the same rule.
 */
export function isUnauthenticatedModeEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  if (isHostedDeployment(env)) return false;
  return env.KAIROS_AUTH_DISABLED === "true";
}

/**
 * Where to send somebody after signing in.
 *
 * Only a path on this app is ever accepted — never an absolute URL, and never a
 * protocol-relative `//host` — so a crafted `?next=` cannot turn the sign-in page
 * into an open redirect.
 */
export function safeNextPath(value: string | null | undefined): string {
  if (!value || !value.startsWith("/")) return "/today";
  // "//host" is protocol-relative, and browsers normalise a backslash to a
  // forward slash, so "/\host" reaches the same place. Refuse both.
  if (value.startsWith("//") || value.startsWith("/\\")) return "/today";
  return value;
}

/**
 * Route classification, shared by the middleware and its tests.
 *
 * Pure and dependency-free for the same reason as the rules above, and so the
 * access matrix can be tested without standing up Supabase.
 *
 * Every entry is matched **exactly**. Prefix matching would be a security bug:
 * `/api/healthy-thing` must not inherit `/api/health`'s exemption, and an
 * unknown path like `/admin` must stay protected rather than fall through.
 */

/** The public landing page. No session, and no Supabase project required. */
export const LANDING_PATH = "/";

/** Pages that only make sense while signed out. */
export const AUTH_PATHS = ["/login", "/register"] as const;

/**
 * Reachable without a session.
 *
 * The sign-in pages are included: they are where a signed-out visitor is *sent*,
 * so they must never redirect to themselves.
 */
export const PUBLIC_PATHS = [
  LANDING_PATH,
  // Uptime checks run before a session exists.
  "/api/health",
  // Where Supabase returns the browser after Google sign-in or an email
  // confirmation — it must never be redirected away.
  "/auth/callback",
  // The daily reminder broadcast. A scheduler has no session, so the route
  // authenticates its caller with a shared secret of its own — and it must not
  // be redirected, because a scheduled request does not follow redirects.
  "/api/cron/daily-reminder",
  // The service worker. Static files are already excluded from middleware by the
  // matcher, so this is belt and braces: a browser cannot register a script it is
  // not allowed to fetch, and a worker that 307s to `/login` fails silently.
  "/sw.js",
  ...AUTH_PATHS,
] as const;

/**
 * `/today/` and `/today` are the same route — Next redirects the former — but
 * middleware sees the raw pathname first, so collapse it here.
 */
function normalizePath(pathname: string): string {
  if (pathname.length <= 1) return pathname;
  const trimmed = pathname.replace(/\/+$/, "");
  return trimmed === "" ? "/" : trimmed;
}

export function isPublicPath(pathname: string): boolean {
  const path = normalizePath(pathname);
  return PUBLIC_PATHS.some((candidate) => candidate === path);
}

export function isAuthPath(pathname: string): boolean {
  const path = normalizePath(pathname);
  return AUTH_PATHS.some((candidate) => candidate === path);
}
