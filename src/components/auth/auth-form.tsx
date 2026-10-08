"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export type AuthMode = "signin" | "signup";

/**
 * The floor the form tells people about. Supabase's own minimum length and
 * character rules are configurable per project, and they win — whatever it
 * rejects is shown verbatim, rather than being re-implemented badly here.
 */
const MIN_PASSWORD_LENGTH = 8;

const COPY: Record<
  AuthMode,
  {
    submit: string;
    pending: string;
    google: string;
    switchText: string;
    switchLabel: string;
    switchHref: string;
  }
> = {
  signin: {
    submit: "Sign in",
    pending: "Signing in…",
    google: "Continue with Google",
    switchText: "New to Kairos?",
    switchLabel: "Create an account",
    switchHref: "/register",
  },
  signup: {
    submit: "Create account",
    pending: "Creating your account…",
    google: "Sign up with Google",
    switchText: "Already have an account?",
    switchLabel: "Sign in",
    switchHref: "/login",
  },
};

/**
 * One form, two modes.
 *
 * Sign-in and sign-up differ only in which Supabase call runs and in the words
 * on the buttons, so they share a component and are rendered by two separate
 * pages (`/login` and `/register`) — each with its own URL, which is better for
 * sharing, bookmarks and search than a tab that cannot be linked to.
 *
 * Google works in both modes: Supabase treats it as a sign-up on first use and a
 * sign-in afterwards, so there is nothing to branch on.
 */
export function AuthForm({
  mode,
  initialError,
  next,
}: {
  mode: AuthMode;
  initialError?: string;
  next: string;
}) {
  const router = useRouter();
  const copy = COPY[mode];

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);

  const isSignUp = mode === "signup";

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (isSignUp && password.length < MIN_PASSWORD_LENGTH) {
      setError(`Choose a password with at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }

    setPending(true);

    try {
      const supabase = createSupabaseBrowserClient();

      if (isSignUp) {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
          },
        });

        if (signUpError) {
          setError(signUpError.message);
          return;
        }

        // With "Confirm email" on there is no session yet — the account only
        // becomes usable once the link is clicked. Hand off to sign-in rather
        // than pretending the user is logged in.
        if (!data.session) {
          setAwaitingConfirmation(true);
          return;
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) {
          setError(signInError.message);
          return;
        }
      }

      router.replace(next);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not continue.");
    } finally {
      setPending(false);
    }
  }

  async function onGoogle() {
    setError(null);
    setPending(true);

    try {
      const supabase = createSupabaseBrowserClient();
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        },
      });

      if (oauthError) {
        setError(oauthError.message);
        setPending(false);
      }
      // Otherwise the browser is navigating to Google: leave the button disabled.
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not reach Google.");
      setPending(false);
    }
  }

  // ---- registered, now waiting for the confirmation email -----------------
  if (awaitingConfirmation) {
    return (
      <div className="flex flex-col gap-4">
        <div
          role="status"
          className="rounded-md border border-primary/40 bg-primary/10 px-4 py-3"
        >
          <p className="text-sm font-medium">Check your inbox</p>
          <p className="mt-1 text-sm text-muted-foreground">
            We sent a confirmation link to{" "}
            <span className="font-medium text-foreground">{email}</span>. Open it,
            then sign in.
          </p>
        </div>

        <Button asChild>
          <Link href={`/login?next=${encodeURIComponent(next)}`}>Go to sign in</Link>
        </Button>

        <button
          type="button"
          onClick={() => setAwaitingConfirmation(false)}
          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          Use a different email address
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            autoFocus
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete={isSignUp ? "new-password" : "current-password"}
            required
            minLength={isSignUp ? MIN_PASSWORD_LENGTH : undefined}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          {isSignUp ? (
            <p className="text-xs text-muted-foreground">
              At least {MIN_PASSWORD_LENGTH} characters.
            </p>
          ) : null}
        </div>

        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <Button type="submit" disabled={pending}>
          {pending ? copy.pending : copy.submit}
        </Button>
      </form>

      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs uppercase tracking-wide text-muted-foreground">or</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <Button type="button" variant="outline" onClick={onGoogle} disabled={pending}>
        <GoogleMark />
        {copy.google}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        {copy.switchText}{" "}
        <Link
          href={`${copy.switchHref}?next=${encodeURIComponent(next)}`}
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          {copy.switchLabel}
        </Link>
      </p>
    </div>
  );
}

/** Inline Google mark: no binary asset, no extra request. */
function GoogleMark() {
  return (
    <svg viewBox="0 0 18 18" aria-hidden="true" className="h-4 w-4">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72a5.41 5.41 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  );
}
