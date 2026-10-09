import { LogOut, ShieldCheck, ShieldOff } from "lucide-react";

import { ThemePicker } from "@/components/settings/theme-picker";
import { Button } from "@/components/ui/button";
import { signOutAction } from "@/server/actions/auth";

/** "ada@example.com" → "AD"; no address at all → the mark. */
function initialsFor(email: string | null): string {
  const local = email?.split("@")[0];
  return local ? local.slice(0, 2).toUpperCase() : "K";
}

/**
 * Who you are signed in as, how the app looks, and the way out.
 *
 * A Server Component: the only interactive parts are the theme picker and the
 * sign-out form (a Server Action), so nothing here needs to ship as JavaScript.
 */
export function ProfilePanel({
  email,
  authEnabled,
}: {
  email: string | null;
  authEnabled: boolean;
}) {
  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border bg-card px-4 py-4">
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-semibold text-primary"
        >
          {initialsFor(email)}
        </span>

        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{email ?? "Local workspace"}</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            {email ? (
              <>
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                Signed in
              </>
            ) : (
              <>
                <ShieldOff className="h-3.5 w-3.5" aria-hidden="true" />
                Sign-in is off
              </>
            )}
          </p>
        </div>

        {authEnabled && email ? (
          <form action={signOutAction} className="ml-auto">
            <Button
              type="submit"
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-destructive"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              Sign out
            </Button>
          </form>
        ) : null}
      </div>

      <div className="border-t border-border pt-4">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-semibold">Appearance</h2>
          <p className="text-xs text-muted-foreground">Saved to your account</p>
        </div>
        <ThemePicker />
      </div>
    </section>
  );
}
