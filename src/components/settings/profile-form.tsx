"use client";

import { Check, Lock } from "lucide-react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { AvatarArt } from "@/components/layout/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AVATARS,
  avatarById,
  avatarTiers,
  avatarUnlockLabel,
  isAvatarUnlocked,
  nextLockedAvatar,
  unlockedAvatarIds,
} from "@/lib/avatars";
import { NICKNAME_MAX_LENGTH } from "@/lib/constants";
import { displayName } from "@/lib/profile";
import { cn } from "@/lib/utils";
import type { SettingsDTO } from "@/types/kairos";
import { updateProfileAction } from "@/server/actions/settings";

/**
 * Loaded on demand: it is the only thing on this page that needs the Supabase
 * browser client, which is large and useless until somebody changes a password.
 */
const ChangePasswordDialog = dynamic(
  () =>
    import("@/components/settings/change-password-dialog").then(
      (mod) => mod.ChangePasswordDialog,
    ),
  { ssr: false },
);

/**
 * The profile editor: avatar, greeting name, email and password.
 *
 * The unlock rule for avatars is shown here and enforced again on the server —
 * the disabled buttons are a hint, not the guard.
 */
export function ProfileForm({
  settings,
  email,
  authEnabled,
  completedCount,
}: {
  settings: SettingsDTO;
  email: string | null;
  authEnabled: boolean;
  /** Lifetime completions, which is what unlocks avatars. */
  completedCount: number;
}) {
  const router = useRouter();
  const [nickname, setNickname] = useState(settings.nickname ?? "");
  const [avatarId, setAvatarId] = useState(settings.avatarId);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [, startTransition] = useTransition();

  const unlocked = unlockedAvatarIds(completedCount);
  const next = nextLockedAvatar(completedCount);
  const selected = avatarById(avatarId);
  const name = displayName(settings.nickname, email);
  const dirty =
    nickname.trim() !== (settings.nickname ?? "") || avatarId !== settings.avatarId;

  async function save() {
    setSaving(true);
    const result = await updateProfileAction({ nickname, avatarId });
    setSaving(false);
    if (!result.ok) {
      toast.error("Couldn't save your profile", { description: result.error });
      return;
    }
    toast.success("Profile saved");
    // The greeting and avatar live in the app shell, which is a different tree
    // from this page, so refresh the shell as well.
    startTransition(() => router.refresh());
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Preview of the current choice, at a readable size. */}
      <div className="flex flex-col items-center gap-4 rounded-lg border border-border bg-accent/30 px-4 py-5 text-center sm:flex-row sm:text-left">
        <AvatarArt
          avatarId={avatarId}
          className="h-24 w-24 ring-2 ring-border"
          glyphClassName="text-3xl"
        />
        <div className="min-w-0">
          <p className="truncate text-base font-semibold">{name}</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {selected.label} · {unlocked.length} of {AVATARS.length} avatars unlocked
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {next
              ? `Complete ${next.remaining} more task${next.remaining === 1 ? "" : "s"} to unlock “${next.avatar.label}”`
              : "Every avatar is unlocked."}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {avatarTiers().map(({ tier, label, avatars }) => (
          <div key={tier} className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-xs font-medium">{label}</p>
              <p className="text-[11px] tabular-nums text-muted-foreground">
                {avatars.filter((avatar) => isAvatarUnlocked(avatar, completedCount)).length}
                /{avatars.length} unlocked
              </p>
            </div>

            <div
              role="radiogroup"
              aria-label={`${label} avatars`}
              className="grid grid-cols-4 gap-3 sm:grid-cols-6 lg:grid-cols-8"
            >
              {avatars.map((avatar) => {
                const isUnlocked = isAvatarUnlocked(avatar, completedCount);
                const active = avatar.id === avatarId;
                return (
                  <button
                    key={avatar.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    aria-label={
                      isUnlocked
                        ? avatar.label
                        : `${avatar.label} — locked, ${avatarUnlockLabel(avatar)}`
                    }
                    title={isUnlocked ? avatar.label : avatarUnlockLabel(avatar)}
                    disabled={!isUnlocked}
                    onClick={() => setAvatarId(avatar.id)}
                    className={cn(
                      "flex flex-col items-center gap-1.5 rounded-lg p-1 transition-colors",
                      isUnlocked ? "hover:bg-accent" : "cursor-not-allowed",
                    )}
                  >
                    <span
                      className={cn(
                        "relative rounded-full p-0.5 transition-shadow",
                        active && "ring-2 ring-primary ring-offset-2 ring-offset-background",
                      )}
                    >
                      <AvatarArt
                        avatarId={avatar.id}
                        className={cn("h-14 w-14", !isUnlocked && "opacity-40 grayscale")}
                        glyphClassName="text-base"
                      />

                      {!isUnlocked ? (
                        <span className="absolute inset-0 grid place-items-center rounded-full bg-background/60">
                          <Lock className="h-4 w-4 text-muted-foreground" />
                        </span>
                      ) : null}

                      {active ? (
                        <span className="absolute -right-0.5 -top-0.5 grid h-4 w-4 place-items-center rounded-full bg-primary">
                          <Check className="h-3 w-3 text-primary-foreground" />
                        </span>
                      ) : null}
                    </span>

                    <span
                      className={cn(
                        "w-full truncate text-center text-[11px] leading-tight",
                        isUnlocked ? "text-muted-foreground" : "text-muted-foreground/60",
                      )}
                    >
                      {avatar.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        <p className="text-xs text-muted-foreground">
          Two avatars are free — the rest unlock three at a time, every 10 completed
          tasks.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-2">
            <Label htmlFor="profile-nickname">Nickname</Label>
            <span
              className={cn(
                "text-[11px] tabular-nums",
                nickname.length >= NICKNAME_MAX_LENGTH
                  ? "text-destructive"
                  : "text-muted-foreground",
              )}
            >
              {nickname.length}/{NICKNAME_MAX_LENGTH}
            </span>
          </div>
          <Input
            id="profile-nickname"
            value={nickname}
            maxLength={NICKNAME_MAX_LENGTH}
            placeholder={displayName(null, email)}
            onChange={(event) => setNickname(event.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Up to {NICKNAME_MAX_LENGTH} characters. Used to greet you in the top bar.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="profile-email">Email</Label>
          <Input
            id="profile-email"
            value={email ?? "Sign-in is turned off"}
            readOnly
            disabled
          />
          <p className="text-xs text-muted-foreground">
            {email ? "Managed by your Kairos account." : "Enabled for local development."}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        {authEnabled && email ? (
          <Button type="button" variant="outline" size="sm" onClick={() => setPasswordOpen(true)}>
            Change password
          </Button>
        ) : (
          <span className="text-xs text-muted-foreground">
            Password changes need a signed-in account.
          </span>
        )}

        <Button type="button" onClick={() => void save()} disabled={saving || !dirty}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </div>

      <ChangePasswordDialog open={passwordOpen} onOpenChange={setPasswordOpen} />
    </div>
  );
}