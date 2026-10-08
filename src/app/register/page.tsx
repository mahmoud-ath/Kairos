import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthForm } from "@/components/auth/auth-form";
import { AuthShell } from "@/components/auth/auth-shell";
import { safeNextPath } from "@/lib/auth-rules";
import { SITE_NAME } from "@/lib/site";
import { isAuthDisabled } from "@/server/auth";

/**
 * Create an account.
 *
 * A page of its own rather than a tab on `/login`, so it can be linked to,
 * bookmarked and found by search engines.
 */

export const metadata: Metadata = {
  title: `Create an account · ${SITE_NAME}`,
  description:
    "Create a free Kairos account with your email address or a Google account. Every account gets its own private workspace.",
  // A public page, unlike /login: it is the one we want people to find.
  robots: { index: true, follow: true },
};

// Never cache: it renders a different result depending on the session.
export const dynamic = "force-dynamic";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;

  // With the gate inert there is no account to create.
  if (isAuthDisabled()) {
    redirect("/today");
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="Free, and your tasks stay private to you."
    >
      <AuthForm
        mode="signup"
        initialError={error ? "We could not complete that sign-up. Please try again." : undefined}
        next={safeNextPath(next)}
      />
    </AuthShell>
  );
}
