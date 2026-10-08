import { NextResponse, type NextRequest } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Where Supabase sends the browser back to.
 *
 * Google sign-in and email confirmation both return here with a one-time
 * `code`, which is exchanged for a session. Because this is a Route Handler it
 * is allowed to write the session cookies — a Server Component is not, which is
 * why the exchange cannot happen on the page itself.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const requested = searchParams.get("next");

  // Only ever bounce to a path on this app, never to another origin.
  const next = requested?.startsWith("/") && !requested.startsWith("//") ? requested : "/today";

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=oauth`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}