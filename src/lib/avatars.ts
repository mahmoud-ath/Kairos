/**
 * The avatar catalogue.
 *
 * Every avatar is a file in `public/avatars/`, grouped into two folders — the
 * `Standard` set and the `Vip` set. `SEEDS` below is the single list of them, so
 * adding or removing an avatar is one line here (plus the artwork file).
 *
 * Unlock rule: the **first two are free**, and the remaining avatars unlock in
 * **groups of three that share one milestone**, 10 completions apart (10, 20,
 * 30, …). The count is a lifetime total read from the immutable `TaskEvent` log
 * (`countCompletions`), so clearing completed tasks never takes an avatar away.
 *
 * Pure and dependency-free (aside from the types), so the rules can be unit
 * tested without a DOM or a database.
 */

export type AvatarTier = "standard" | "vip";

export type AvatarUnlock =
  | { kind: "free" }
  | { kind: "completed"; count: number };

export type Avatar = {
  id: string;
  label: string;
  tier: AvatarTier;
  /** Public path of the artwork. */
  src: string;
  /** Up to two letters, drawn while the artwork loads or if it fails. */
  initials: string;
  /** Backdrop behind the artwork; also the fallback's background. */
  gradient: string;
  unlock: AvatarUnlock;
};

/* -------------------------------------------------------------------------- */
/* Catalogue definition                                                       */
/* -------------------------------------------------------------------------- */

/**
 * File extension of the artwork.
 *
 * Every `src` is built from `<folder>/<name>.<ARTWORK_EXTENSION>`, so exporting
 * the whole set as PNG or WebP instead is a one-line change here.
 */
export const ARTWORK_EXTENSION = "svg";

const ARTWORK_FOLDERS: Record<AvatarTier, string> = {
  standard: "Standard",
  vip: "Vip",
};

export const AVATAR_TIER_LABELS: Record<AvatarTier, string> = {
  standard: "Standard",
  vip: "Vip",
};

/** `name` is the artwork's file name without folder or extension. */
type AvatarSeed = { name: string; tier: AvatarTier };

/**
 * Order is the order in the picker, and it is what decides the unlock order:
 * the first `FREE_AVATAR_COUNT` entries are free, then each following group of
 * `UNLOCK_GROUP_SIZE` shares one milestone `UNLOCK_STEP` apart.
 */
const SEEDS: readonly AvatarSeed[] = [
  // Standard set.
  { name: "spark", tier: "standard" },
  { name: "moroccan", tier: "standard" },
  { name: "leaf", tier: "standard" },
  { name: "flame", tier: "standard" },
  { name: "wave", tier: "standard" },
  { name: "mountain", tier: "standard" },
  { name: "comet", tier: "standard" },
  { name: "crown", tier: "standard" },
  { name: "rocket", tier: "standard" },
  { name: "trophy", tier: "standard" },
  { name: "diamond", tier: "standard" },

  // Vip set.
  { name: "01-athena-wisdom", tier: "vip" },
  { name: "01-rogue-captain", tier: "vip" },
  { name: "01-silver-swordswoman", tier: "vip" },
  { name: "02-anime-adventurer", tier: "vip" },
  { name: "03-atlas-responsibility", tier: "vip" },
  { name: "03-crimson-dragon", tier: "vip" },
  { name: "03-violet-ninja", tier: "vip" },
  { name: "04-phoenix-resilience", tier: "vip" },
  { name: "05-obsidian-dragon", tier: "vip" },
  { name: "06-fox-adaptability", tier: "vip" },
  { name: "06-ice-dragon", tier: "vip" },
  { name: "06-star-scientist", tier: "vip" },
  { name: "07-phoenix-warrior", tier: "vip" },
  { name: "09-cat-samurai", tier: "vip" },
  { name: "09-ocean-guardian", tier: "vip" },
  { name: "11-robot-scientist", tier: "vip" },
  { name: "12-biologist", tier: "vip" },
  { name: "12-warrior-discipline", tier: "vip" },
  { name: "14-gamer-cat", tier: "vip" },
  { name: "kairos-chinese-original", tier: "vip" },
  { name: "kairos-moroccan-original", tier: "vip" },
  { name: "kairos-traveler-original", tier: "vip" },
];

/* -------------------------------------------------------------------------- */
/* Unlock rule                                                                */
/* -------------------------------------------------------------------------- */

/** How many avatars anyone can pick straight away. */
export const FREE_AVATAR_COUNT = 2;

/** How many avatars a single milestone unlocks. */
export const UNLOCK_GROUP_SIZE = 3;

/** Completed tasks between one group's milestone and the next. */
export const UNLOCK_STEP = 10;

/** `"01-athena-wisdom"` → `"Athena Wisdom"`. */
function labelFromName(name: string): string {
  return name
    .replace(/^\d+-/, "")
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/** Up to two initials, for the fallback shown while artwork loads. */
function initialsFromLabel(label: string): string {
  const words = label.split(/\s+/).filter(Boolean);
  if (words.length === 0) return "K";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

/**
 * Backdrops for the fallback, picked by hashing the id so every avatar gets a
 * stable colour without a hand-written entry for each one.
 */
const FALLBACK_GRADIENTS: readonly string[] = [
  "linear-gradient(135deg, #34d399, #059669)",
  "linear-gradient(135deg, #a3e635, #16a34a)",
  "linear-gradient(135deg, #fb923c, #dc2626)",
  "linear-gradient(135deg, #38bdf8, #2563eb)",
  "linear-gradient(135deg, #94a3b8, #334155)",
  "linear-gradient(135deg, #c084fc, #4338ca)",
  "linear-gradient(135deg, #fde047, #ca8a04)",
  "linear-gradient(135deg, #f472b6, #7c3aed)",
  "linear-gradient(135deg, #fbbf24, #b45309)",
  "linear-gradient(135deg, #67e8f9, #0891b2)",
  "linear-gradient(135deg, #fb7185, #be123c)",
  "linear-gradient(135deg, #4ade80, #0f766e)",
];

function gradientFor(id: string): string {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash * 31 + id.charCodeAt(index)) % 1_000_003;
  }
  return FALLBACK_GRADIENTS[hash % FALLBACK_GRADIENTS.length];
}

/** The requirement a given catalogue position carries. */
function unlockAt(index: number): AvatarUnlock {
  if (index < FREE_AVATAR_COUNT) return { kind: "free" };
  const group = Math.floor((index - FREE_AVATAR_COUNT) / UNLOCK_GROUP_SIZE);
  return { kind: "completed", count: (group + 1) * UNLOCK_STEP };
}

export const AVATARS: readonly Avatar[] = SEEDS.map(({ name, tier }, index) => {
  const label = labelFromName(name);
  return {
    id: name,
    label,
    tier,
    src: `/avatars/${ARTWORK_FOLDERS[tier]}/${name}.${ARTWORK_EXTENSION}`,
    initials: initialsFromLabel(label),
    gradient: gradientFor(name),
    unlock: unlockAt(index),
  };
});

/** The avatar a brand-new account starts with (free, so always selectable). */
export const DEFAULT_AVATAR_ID = "spark";

/**
 * Whether the artwork is drawn at all.
 *
 * On by default: the image is requested and the initials fallback is what shows
 * if the request fails. Kept as a documented switch for a deployment that would
 * rather not serve the files at all.
 */
export const AVATAR_ARTWORK_READY = true;

/** Every distinct milestone, in ascending order (e.g. `[10, 20, 30, …]`). */
export const AVATAR_MILESTONES: readonly number[] = [
  ...new Set(
    AVATARS.flatMap((avatar) =>
      avatar.unlock.kind === "completed" ? [avatar.unlock.count] : [],
    ),
  ),
];

/** The catalogue grouped for the picker, in tier order. */
export function avatarTiers(): { tier: AvatarTier; label: string; avatars: Avatar[] }[] {
  return (Object.keys(ARTWORK_FOLDERS) as AvatarTier[]).map((tier) => ({
    tier,
    label: AVATAR_TIER_LABELS[tier],
    avatars: AVATARS.filter((avatar) => avatar.tier === tier),
  }));
}

export const AVATAR_IDS: readonly string[] = AVATARS.map((avatar) => avatar.id);

export function isAvatarId(value: unknown): value is string {
  return typeof value === "string" && AVATARS.some((avatar) => avatar.id === value);
}

/** Unknown ids fall back to the default instead of rendering nothing. */
export function avatarById(id: string | null | undefined): Avatar {
  return AVATARS.find((avatar) => avatar.id === id) ?? AVATARS[0];
}

export function isAvatarUnlocked(
  avatar: Avatar,
  completedCount: number,
): boolean {
  if (avatar.unlock.kind === "free") return true;
  return completedCount >= avatar.unlock.count;
}

/** Ids selectable at this point in the account's life. */
export function unlockedAvatarIds(completedCount: number): string[] {
  return AVATARS.filter((avatar) => isAvatarUnlocked(avatar, completedCount)).map(
    (avatar) => avatar.id,
  );
}

/** How an unlock requirement reads in the UI. */
export function avatarUnlockLabel(avatar: Avatar): string {
  if (avatar.unlock.kind === "free") return "Free";
  return `Complete ${avatar.unlock.count} tasks`;
}

/**
 * The next avatar to earn, with how many tasks are still missing — or `null`
 * when every avatar is unlocked. Used for the "keep going" hint.
 */
export function nextLockedAvatar(
  completedCount: number,
): { avatar: Avatar; remaining: number } | null {
  const next = AVATARS.find(
    (avatar) => avatar.unlock.kind === "completed" && avatar.unlock.count > completedCount,
  );
  if (!next || next.unlock.kind !== "completed") return null;
  return { avatar: next, remaining: next.unlock.count - completedCount };
}
