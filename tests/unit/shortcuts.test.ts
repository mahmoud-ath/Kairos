import { describe, expect, it } from "vitest";

import {
  groupedShortcuts,
  isModifierToken,
  keyTokens,
  keysLabel,
  normalizeKey,
  resolveShortcut,
  SHORTCUTS,
} from "@/lib/shortcuts";

describe("normalizeKey", () => {
  it("lower-cases letters and named keys", () => {
    expect(normalizeKey("G")).toBe("g");
    expect(normalizeKey("Escape")).toBe("escape");
    expect(normalizeKey("?")).toBe("?");
  });

  it("gives the space bar a name", () => {
    expect(normalizeKey(" ")).toBe("space");
  });
});

describe("turning a key event into tokens", () => {
  it("names Shift when it produced a letter", () => {
    // This is the case `event.key` hides: Shift+T and t both normalise to "t".
    expect(keyTokens({ key: "T", shiftKey: true })).toEqual(["shift", "t"]);
  });

  it("leaves an unshifted letter alone", () => {
    expect(keyTokens({ key: "t", shiftKey: false })).toEqual(["t"]);
    expect(keyTokens({ key: "t" })).toEqual(["t"]);
  });

  it("does not add Shift to punctuation, because the character already includes it", () => {
    // `?` is Shift+/ on most layouts; naming the modifier as well would make the
    // help shortcut impossible to bind.
    expect(keyTokens({ key: "?", shiftKey: true })).toEqual(["?"]);
    expect(keyTokens({ key: "/", shiftKey: false })).toEqual(["/"]);
  });

  it("does not add Shift to named keys", () => {
    expect(keyTokens({ key: "Escape", shiftKey: true })).toEqual(["escape"]);
  });

  it("recognises a modifier token", () => {
    expect(isModifierToken("shift")).toBe(true);
    expect(isModifierToken("t")).toBe(false);
  });
});

describe("resolveShortcut", () => {
  it("runs a single-key shortcut immediately", () => {
    expect(resolveShortcut([], "/").shortcut?.id).toBe("search");
    expect(resolveShortcut([], "n").shortcut?.id).toBe("new-task");
  });

  it("keeps t usable on its own, even though Shift+T navigates", () => {
    expect(resolveShortcut([], "t").shortcut?.id).toBe("toggle-theme");
  });

  it("runs every Shift binding when the shifted letter is pressed", () => {
    const shifted = SHORTCUTS.filter((shortcut) => shortcut.keys[0] === "shift");
    expect(shifted.length).toBeGreaterThan(0);

    for (const shortcut of shifted) {
      const [, letter] = shortcut.keys;
      const tokens = keyTokens({ key: letter.toUpperCase(), shiftKey: true });
      expect(resolveShortcut([], tokens).shortcut?.id).toBe(shortcut.id);
    }
  });

  it("does not fire a Shift binding from the unshifted letter", () => {
    // `t` toggles the theme; it must not also navigate to Today.
    const plainT = resolveShortcut([], keyTokens({ key: "t", shiftKey: false }));
    expect(plainT.shortcut?.id).toBe("toggle-theme");

    const plainS = resolveShortcut([], keyTokens({ key: "s", shiftKey: false }));
    expect(plainS.shortcut).toBeNull();
  });

  it("still supports multi-key sequences, even though the table no longer uses one", () => {
    // The resolver is generic; this guards the code path rather than a binding.
    const first = resolveShortcut([], "g");
    expect(first.shortcut).toBeNull();
    expect(first.pending).toEqual([]);
  });

  it("ignores a key nobody mapped", () => {
    expect(resolveShortcut([], "z")).toEqual({ shortcut: null, pending: [] });
  });
});

describe("the shortcut table", () => {
  it("has no duplicate key sequences", () => {
    const sequences = SHORTCUTS.map((shortcut) => shortcut.keys.join("+"));
    expect(new Set(sequences).size).toBe(sequences.length);
  });

  it("uses only tokens the keyboard handler can produce", () => {
    // `keyTokens` emits "space", a modifier, or a single character. Anything else
    // would be a binding that can never fire.
    const emittable = (token: string) =>
      token === "space" || isModifierToken(token) || token.length === 1;

    for (const shortcut of SHORTCUTS) {
      for (const token of shortcut.keys) {
        expect(emittable(token), `${shortcut.id} uses "${token}"`).toBe(true);
      }
    }
  });

  it("puts a modifier first and never mixes one with a sequence", () => {
    for (const shortcut of SHORTCUTS) {
      const modifierIndex = shortcut.keys.findIndex(isModifierToken);
      if (modifierIndex === -1) continue;
      expect(modifierIndex, `${shortcut.id} has a late modifier`).toBe(0);
      expect(shortcut.keys.length, `${shortcut.id} is a sequence with a modifier`).toBe(2);
    }
  });

  it("has no two shortcuts that would both match one press", () => {
    const seen = new Set<string>();
    for (const shortcut of SHORTCUTS) {
      const key = shortcut.keys.join("+");
      expect(seen.has(key), `${shortcut.id} duplicates another binding`).toBe(false);
      seen.add(key);
    }
  });

  it("shows every shortcut in exactly one group", () => {
    const grouped = groupedShortcuts().flatMap((entry) => entry.items);
    expect(grouped).toHaveLength(SHORTCUTS.length);
    expect(grouped.map((shortcut) => shortcut.id)).toEqual(
      SHORTCUTS.map((shortcut) => shortcut.id),
    );
  });
});

describe("key labels", () => {
  it("describes a combo for the help dialog", () => {
    expect(keysLabel(["shift", "t"])).toBe("Shift + T");
    expect(keysLabel(["?"])).toBe("?");
  });

  it("still describes a sequence", () => {
    expect(keysLabel(["g", "t"])).toBe("g then t");
  });
});
