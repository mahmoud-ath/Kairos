import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthForm } from "@/components/auth/auth-form";
import { AuthShell } from "@/components/auth/auth-shell";
import { safeNextPath } from "@/lib/auth-rules";
import { SITE_NAME } from "@/lib/site";
import { isAuthDisabled } from "@/server/auth";

/**
 * Sign in.
 *
 * Outside the `(app)` route group on purpose: no sidebar, and nothing that
 * touches the database runs before the visitor is authenticated.
 */

export const metadata: Metadata = {
  title: `Sign in · ${SITE_NAME}`,
  description:
    "Sign in to Kairos with your email address or a Google account. Your tasks, subtasks and categories stay private to you.",
  // A private page: keep it out of search engines and sitemaps.
  robots: { index: false, follow: false },
};

// Never cache: it renders a different result depending on the session.
export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;

  // With the gate inert there is nothing to sign in to.
  if (isAuthDisabled()) {
    redirect("/today");
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to pick up where you left off."
    >
      <AuthForm
        mode="signin"
        initialError={
          error === "not_allowed"
            ? "That account is not allowed to use this workspace."
            : error
              ? "We could not complete that sign-in. Please try again."
              : undefined
        }
        next={safeNextPath(next)}
      />
    </AuthShell>
  );
}
