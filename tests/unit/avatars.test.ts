import { describe, expect, it } from "vitest";

import {
  AVATARS,
  AVATAR_IDS,
  AVATAR_MILESTONES,
  avatarById,
  avatarTiers,
  avatarUnlockLabel,
  DEFAULT_AVATAR_ID,
  FREE_AVATAR_COUNT,
  isAvatarId,
  isAvatarUnlocked,
  nextLockedAvatar,
  UNLOCK_GROUP_SIZE,
  UNLOCK_STEP,
  unlockedAvatarIds,
} from "@/lib/avatars";

describe("avatar catalogue", () => {
  it("has unique ids, labels and artwork paths", () => {
    expect(AVATARS.length).toBeGreaterThan(FREE_AVATAR_COUNT);
    expect(new Set(AVATAR_IDS).size).toBe(AVATARS.length);

    for (const avatar of AVATARS) {
      expect(avatar.label).not.toBe("");
      expect(avatar.initials).toMatch(/^[A-Z0-9]{1,2}$/);
      expect(avatar.src).toMatch(/^\/avatars\/(Standard|Vip)\/.+\.svg$/);
      expect(avatar.gradient).toContain("linear-gradient");
    }
  });

  it("groups the catalogue into the Standard and Vip tiers", () => {
    const tiers = avatarTiers();
    expect(tiers.map((entry) => entry.tier)).toEqual(["standard", "vip"]);
    expect(tiers[0].avatars.length).toBeGreaterThan(0);
    expect(tiers[1].avatars.length).toBeGreaterThan(0);
    expect(tiers[0].avatars.length + tiers[1].avatars.length).toBe(AVATARS.length);
  });

  it("starts everyone on a free avatar", () => {
    expect(avatarById(DEFAULT_AVATAR_ID).unlock.kind).toBe("free");
  });
});

describe("avatar unlock rule", () => {
  /** The milestone the catalogue position should carry. */
  const milestoneAt = (index: number) =>
    (Math.floor((index - FREE_AVATAR_COUNT) / UNLOCK_GROUP_SIZE) + 1) * UNLOCK_STEP;

  it("leaves exactly the first two free", () => {
    expect(FREE_AVATAR_COUNT).toBe(2);
    const free = AVATARS.filter((avatar) => avatar.unlock.kind === "free");
    expect(free).toHaveLength(FREE_AVATAR_COUNT);
    expect(unlockedAvatarIds(0)).toEqual(AVATAR_IDS.slice(0, FREE_AVATAR_COUNT));
  });

  it("gives every group of three one shared milestone", () => {
    for (let index = FREE_AVATAR_COUNT; index < AVATARS.length; index += 1) {
      expect(AVATARS[index].unlock).toEqual({
        kind: "completed",
        count: milestoneAt(index),
      });
    }
  });

  it("unlocks a whole group when its milestone is reached", () => {
    const first = AVATARS[FREE_AVATAR_COUNT];
    expect(isAvatarUnlocked(first, UNLOCK_STEP - 1)).toBe(false);
    expect(isAvatarUnlocked(first, UNLOCK_STEP)).toBe(true);

    const group = AVATARS.slice(FREE_AVATAR_COUNT, FREE_AVATAR_COUNT + UNLOCK_GROUP_SIZE);
    expect(unlockedAvatarIds(UNLOCK_STEP)).toEqual([
      ...AVATAR_IDS.slice(0, FREE_AVATAR_COUNT),
      ...group.map((avatar) => avatar.id),
    ]);
  });

  it("lists every milestone once, in ascending order", () => {
    const milestones = [...AVATAR_MILESTONES];
    expect(milestones).toEqual([...milestones].sort((a, b) => a - b));
    expect(new Set(milestones).size).toBe(milestones.length);
    expect(milestones[0]).toBe(UNLOCK_STEP);
    expect(milestones.at(-1)).toBe(milestoneAt(AVATARS.length - 1));
  });

  it("unlocks everything once past the last milestone", () => {
    expect(unlockedAvatarIds(1_000_000)).toEqual([...AVATAR_IDS]);
  });

  it("falls back to the default avatar for an unknown id", () => {
    expect(avatarById("nope").id).toBe(DEFAULT_AVATAR_ID);
    expect(avatarById(null).id).toBe(DEFAULT_AVATAR_ID);
    expect(isAvatarId("nope")).toBe(false);
    expect(isAvatarId(DEFAULT_AVATAR_ID)).toBe(true);
  });

  it("labels unlock requirements", () => {
    expect(avatarUnlockLabel(AVATARS[0])).toBe("Free");
    expect(avatarUnlockLabel(AVATARS[FREE_AVATAR_COUNT])).toBe(
      `Complete ${UNLOCK_STEP} tasks`,
    );
  });

  it("points at the next group to earn and counts what is left", () => {
    expect(nextLockedAvatar(0)).toMatchObject({ remaining: UNLOCK_STEP });
    expect(nextLockedAvatar(UNLOCK_STEP)).toMatchObject({ remaining: UNLOCK_STEP });
    expect(nextLockedAvatar(1_000_000)).toBeNull();
  });
});
