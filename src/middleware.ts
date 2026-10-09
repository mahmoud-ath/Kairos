import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import {
  isAuthPath,
  isEmailAllowed,
  isPublicPath,
  LANDING_PATH,
} from "@/lib/auth-rules";

/**
 * Session refresh + access gate.
 *
 * `@supabase/ssr` expects a middleware (or route handler) to refresh the auth
 * cookies, because Server Components cannot write them. The gate lives here for
 * the same reason: this is the only place that can clear an unwanted session.
 *
 * The gate is on by default. `KAIROS_AUTH_DISABLED=true` switches it off for
 * local development and the Playwright suite; a deployment that is neither
 * configured nor explicitly disabled gets an error instead of an open door.
 *
 * The one exception is the landing page: it is static marketing content, so it
 * is served without requiring Supabase at all — see `LANDING_PATH`. The single
 * thing that can override that is a **session cookie**: a visitor who is known
 * to be signed in is sent straight to their workspace instead of being shown the
 * pitch and asked to sign in again.
 */

const LOGIN_PATH = "/login";

/**
 * Shown when the gate is on but the Supabase project is missing. This is a
 * deployment error, so it is loud and it blocks every route — `/api/health`
 * included, because a health check that passes on a broken deployment is worse
 * than no health check at all.
 */
const CONFIGURATION_ERROR = [
  "Kairos is misconfigured: authentication is enabled but Supabase is not set up.",
  "",
  "Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (docs/auth-setup.md),",
  "or set KAIROS_AUTH_DISABLED=true to run without sign-in.",
  "",
  "That flag is for local development only. It removes the gate that keeps each",
  "account's tasks separate from everybody else's.",
].join("\n");

function copyCookies(from: NextResponse, to: NextResponse): NextResponse {
  for (const cookie of from.cookies.getAll()) {
    to.cookies.set(cookie);
  }
  return to;
}

/**
 * Does this request carry a Supabase session cookie?
 *
 * The cheapest possible question — a string test, no network — used to decide
 * whether it is worth asking Supabase who the visitor is. `@supabase/ssr` names
 * the cookie `sb-<project-ref>-auth-token`, and splits a large one into
 * `.0`, `.1`, … chunks, hence the pattern.
 */
function hasSessionCookie(request: NextRequest): boolean {
  return request.cookies
    .getAll()
    .some((cookie) => /^sb-.*-auth-token(\.\d+)?$/.test(cookie.name));
}

/**
 * Build a Supabase client whose cookie writes land on the response.
 *
 * `@supabase/ssr` expects a middleware (or route handler) to refresh the auth
 * cookies, because Server Components cannot write them. The returned `response`
 * is the one that must be sent — or copied onto any redirect, so a refreshed
 * session is not dropped.
 */
async function resolveSession(request: NextRequest, url: string, anonKey: string) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // Refreshes the session if needed and tells us who is signed in.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { supabase, user, response };
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const authDisabled = process.env.KAIROS_AUTH_DISABLED === "true";

  // The landing page is public, so it is served before anything else is
  // considered: no session refresh, and no Supabase configuration required. Its
  // content is static, so middleware passing through keeps it prerenderable.
  if (pathname === LANDING_PATH) {
    // A visitor who is already signed in belongs in their workspace, not on the
    // marketing page. Nobody is verified unless a session cookie is actually
    // present, so the common case costs one string test — and with no Supabase
    // project at all the landing page still renders, signed out.
    if (url && anonKey && !authDisabled && hasSessionCookie(request)) {
      const { user, response } = await resolveSession(request, url, anonKey);
      if (user && isEmailAllowed(user.email)) {
        return copyCookies(response, NextResponse.redirect(new URL("/today", request.url)));
      }
    }
    return NextResponse.next();
  }

  // Explicit opt-out, for local development and the Playwright suite only.
  if (authDisabled) {
    return NextResponse.next();
  }

  // Auth is on but the project is not configured: refuse the request. Going
  // ahead would fall back to one shared workspace, readable by any visitor.
  if (!url || !anonKey) {
    return new NextResponse(CONFIGURATION_ERROR, {
      status: 500,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  }

  const { supabase, user, response } = await resolveSession(request, url, anonKey);

  function redirectTo(target: string, search = ""): NextResponse {
    const nextUrl = request.nextUrl.clone();
    nextUrl.pathname = target;
    nextUrl.search = search;
    return copyCookies(response, NextResponse.redirect(nextUrl));
  }

  // Signed in with an email that is not on the allowlist: drop the session.
  if (user && !isEmailAllowed(user.email)) {
    await supabase.auth.signOut();
    return redirectTo(LOGIN_PATH, "?error=not_allowed");
  }

  // Already signed in: the sign-in and sign-up pages have nothing to offer.
  if (user && isAuthPath(pathname)) {
    return redirectTo("/today");
  }

  // Signed out: everything that is not explicitly public goes to the sign-in
  // page, carrying where they were headed. This deliberately catches unknown
  // paths too — a route that does not exist yet fails closed, not open.
  if (!user && !isPublicPath(pathname)) {
    const next = `${pathname}${request.nextUrl.search}`;
    return redirectTo(LOGIN_PATH, `?next=${encodeURIComponent(next)}`);
  }

  return response;
}

export const config = {
  // Everything except Next's own assets and static files in `public/`.
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|woff|woff2|ttf|otf|css|js|json|txt|xml|webmanifest)$).*)",
  ],
};
