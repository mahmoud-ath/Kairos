import { LogOut } from "lucide-react";

import { FontScalePicker } from "@/components/settings/font-scale-picker";
import { ProfileForm } from "@/components/settings/profile-form";
import { ThemePicker } from "@/components/settings/theme-picker";
import { Button } from "@/components/ui/button";
import type { SettingsDTO } from "@/types/kairos";
import { signOutAction } from "@/server/actions/auth";

/**
 * Who you are, how you are greeted, and how the app looks.
 *
 * A Server Component: the interactive parts (the profile form, the theme
 * picker) are the only client islands, so the identity itself never has to
 * ship as JavaScript.
 */
export function ProfilePanel({
  settings,
  email,
  authEnabled,
  completedCount,
}: {
  settings: SettingsDTO;
  email: string | null;
  authEnabled: boolean;
  /** Lifetime completed tasks, which is what unlocks avatars. */
  completedCount: number;
}) {
  return (
    <section
      id="profile"
      className="flex scroll-mt-20 flex-col gap-5 rounded-lg border border-border bg-card px-4 py-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Profile</h2>
          <p className="text-xs text-muted-foreground">
            Your nickname, avatar and password.
          </p>
        </div>

        {authEnabled && email ? (
          <form action={signOutAction}>
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

      <ProfileForm
        settings={settings}
        email={email}
        authEnabled={authEnabled}
        completedCount={completedCount}
      />

      <div className="border-t border-border pt-4">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-semibold">Appearance</h2>
          <p className="text-xs text-muted-foreground">Saved to your account</p>
        </div>
        <ThemePicker />

        <div className="mt-4 flex flex-col gap-2">
          <p className="text-xs font-medium">Text size</p>
          <FontScalePicker value={settings.fontScale} />
          <p className="text-xs text-muted-foreground">
            Scales the whole interface, not just text.
          </p>
        </div>

      </div>
    </section>
  );
}
