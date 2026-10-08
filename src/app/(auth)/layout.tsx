import type { ReactNode } from "react";

/**
 * Authentication area — `/login` and `/register`.
 *
 * A route group, so it adds no URL segment: the routes stay at `/login` and
 * `/register` rather than moving under `/auth`.
 *
 * This layout owns the full-screen frame. The pages render their own heading and
 * form inside `AuthShell`, which is a Server Component; only the form itself is
 * interactive.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="grid min-h-screen place-items-center px-4 py-10">{children}</main>
  );
}
