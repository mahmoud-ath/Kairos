import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { isEmailAllowed } from "@/lib/auth-rules";

/**
 * Session refresh + access gate.
 *
 * `@supabase/ssr` expects a middleware (or route handler) to refresh the auth
 * cookies, because Server Components cannot write them. The gate lives here for
 * the same reason: this is the only place that can clear an unwanted session.
 *
 * When Supabase is not configured — local development, Playwright, a private
 * self-hosted instance — the middleware does nothing and Kairos behaves exactly
 * as it did before auth existed.
 */

const LOGIN_PATH = "/login";

/** Reachable without a session. Everything else under the matcher is gated. */
const PUBLIC_PATHS = ["/api/health"];

function copyCookies(from: NextResponse, to: NextResponse): NextResponse {
  for (const cookie of from.cookies.getAll()) {
    to.cookies.set(cookie);
  }
  return to;
}

export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey || process.env.KAIROS_AUTH_DISABLED === "true") {
    return NextResponse.next();
  }

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

  const { pathname } = request.nextUrl;

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

  // Already signed in: the sign-in page has nothing to offer.
  if (user && pathname === LOGIN_PATH) {
    return redirectTo("/today");
  }

  const isPublic = PUBLIC_PATHS.some((path) => pathname === path);

  if (!user && !isPublic && pathname !== LOGIN_PATH) {
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
