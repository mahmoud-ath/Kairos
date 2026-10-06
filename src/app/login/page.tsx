import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { LoginForm } from "@/app/login/login-form";
import { isAuthDisabled } from "@/server/auth";
import { SITE_NAME } from "@/lib/site";

/**
 * The sign-in page.
 *
 * It sits outside the `(app)` route group on purpose: no sidebar, no task
 * queries, and nothing that touches the database runs before the visitor is
 * authenticated.
 */

export const metadata: Metadata = {
  title: `Sign in · ${SITE_NAME}`,
  description: "Sign in to your Kairos workspace.",
  // A private page: keep it out of search engines and sitemaps.
  robots: { index: false, follow: false },
};

// Never cache: it renders a different result depending on the session.
export const dynamic = "force-dynamic";

/** Only allow same-app, absolute paths as the post-sign-in destination. */
function safeNext(value: string | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/today";
  return value;
}

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
    <main className="grid min-h-screen place-items-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
            K
          </span>
          <div>
            <p className="text-sm font-semibold leading-none tracking-tight">Kairos</p>
            <p className="mt-0.5 text-[11px] leading-none text-muted-foreground">
              Personal task manager
            </p>
          </div>
        </div>

        <h1 className="text-lg font-semibold tracking-tight">Sign in</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          This workspace is private. Use the account you created in Supabase.
        </p>

        {error === "not_allowed" ? (
          <p
            role="alert"
            className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            That account is not allowed to use this workspace.
          </p>
        ) : null}

        <div className="mt-6">
          <LoginForm next={safeNext(next)} />
        </div>
      </div>
    </main>
  );
}
