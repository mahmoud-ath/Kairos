"use client";

import Image from "next/image";
import { useState } from "react";

import { avatarById, AVATAR_ARTWORK_READY } from "@/lib/avatars";
import { cn } from "@/lib/utils";

/**
 * An avatar, drawn as the uploaded artwork when it is available and as an
 * initials badge on a coloured gradient otherwise.
 *
 * Purely decorative: the caller (a button, a list item) owns the accessible
 * name, which is why the whole thing is `aria-hidden`.
 */
export function AvatarArt({
  avatarId,
  className,
  glyphClassName,
}: {
  avatarId: string;
  className?: string;
  /** Controls the fallback initials' size; defaults to a comfortable 1rem. */
  glyphClassName?: string;
}) {
  const avatar = avatarById(avatarId);
  const [failed, setFailed] = useState(false);
  const showArtwork = AVATAR_ARTWORK_READY && !failed;

  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative grid shrink-0 select-none place-items-center overflow-hidden rounded-full",
        className,
      )}
      style={{ backgroundImage: avatar.gradient }}
    >
      <span
        className={cn(
          "font-semibold uppercase tracking-wide text-white/90",
          glyphClassName ?? "text-base",
        )}
      >
        {avatar.initials}
      </span>

      {showArtwork ? (
        <Image
          src={avatar.src}
          alt=""
          fill
          unoptimized
          sizes="128px"
          onError={() => setFailed(true)}
          className="object-cover"
        />
      ) : null}
    </span>
  );
}
