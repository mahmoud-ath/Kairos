import { describe, expect, it } from "vitest";

import {
  groupedShortcuts,
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

describe("resolveShortcut", () => {
  it("runs a single-key shortcut immediately", () => {
    expect(resolveShortcut([], "/").shortcut?.id).toBe("search");
    expect(resolveShortcut([], "n").shortcut?.id).toBe("new-task");
  });

  it("waits for the second key of a sequence", () => {
    const first = resolveShortcut([], "g");
    expect(first.shortcut).toBeNull();
    expect(first.pending).toEqual(["g"]);

    const second = resolveShortcut(first.pending, "t");
    expect(second.shortcut?.id).toBe("go-today");
    expect(second.pending).toEqual([]);
  });

  it("resolves every two-key shortcut in the table", () => {
    for (const shortcut of SHORTCUTS.filter((entry) => entry.keys.length === 2)) {
      const [firstKey, secondKey] = shortcut.keys;
      const { pending } = resolveShortcut([], firstKey);
      expect(resolveShortcut(pending, secondKey).shortcut?.id).toBe(shortcut.id);
    }
  });

  it("drops a prefix that cannot continue", () => {
    expect(resolveShortcut([], "g").pending).toEqual(["g"]);
    expect(resolveShortcut(["g"], "z")).toEqual({ shortcut: null, pending: [] });
  });

  it("ignores a key nobody mapped", () => {
    expect(resolveShortcut([], "z")).toEqual({ shortcut: null, pending: [] });
  });

  it("keeps t usable on its own, even though g t exists", () => {
    expect(resolveShortcut([], "t").shortcut?.id).toBe("toggle-theme");
  });
});

describe("the shortcut table", () => {
  it("has no duplicate key sequences", () => {
    const sequences = SHORTCUTS.map((shortcut) => shortcut.keys.join("+"));
    expect(new Set(sequences).size).toBe(sequences.length);
  });

  it("describes sequences for screen readers", () => {
    expect(keysLabel(["g", "t"])).toBe("g then t");
  });

  it("shows every shortcut in exactly one group", () => {
    const grouped = groupedShortcuts().flatMap((entry) => entry.items);
    expect(grouped).toHaveLength(SHORTCUTS.length);
    expect(grouped.map((shortcut) => shortcut.id)).toEqual(
      SHORTCUTS.map((shortcut) => shortcut.id),
    );
  });
});
