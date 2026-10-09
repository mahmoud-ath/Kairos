/**
 * Keyboard shortcuts.
 *
 * Pure and dependency-free, so the matching rules can be tested without a DOM —
 * the listener that feeds them lives in `ShortcutProvider`.
 *
 * Single keys are matched immediately; a key that only ever starts a longer
 * sequence ("g") is held for `SEQUENCE_TIMEOUT_MS`, which is what makes `g t`
 * work without breaking `t`.
 */

export type ShortcutId =
  | "go-today"
  | "go-tasks"
  | "go-completed"
  | "go-statistics"
  | "go-settings"
  | "search"
  | "new-task"
  | "toggle-theme"
  | "help";

export type ShortcutGroup = "Go to" | "Actions";

export type Shortcut = {
  id: ShortcutId;
  /** The keys in order. A one-element list is a plain key press. */
  keys: readonly string[];
  label: string;
  group: ShortcutGroup;
};

export const SHORTCUTS: readonly Shortcut[] = [
  { id: "go-today", keys: ["g", "t"], label: "Today", group: "Go to" },
  { id: "go-tasks", keys: ["g", "a"], label: "All Tasks", group: "Go to" },
  { id: "go-completed", keys: ["g", "c"], label: "Completed", group: "Go to" },
  { id: "go-statistics", keys: ["g", "s"], label: "Statistics", group: "Go to" },
  { id: "go-settings", keys: ["g", ","], label: "Settings", group: "Go to" },
  { id: "search", keys: ["/"], label: "Search tasks", group: "Actions" },
  { id: "new-task", keys: ["n"], label: "New task", group: "Actions" },
  { id: "toggle-theme", keys: ["t"], label: "Switch theme", group: "Actions" },
  { id: "help", keys: ["?"], label: "Keyboard shortcuts", group: "Actions" },
];

/** How long the first key of a sequence waits for its second. */
export const SEQUENCE_TIMEOUT_MS = 1200;

/** Groups in the order the help dialog shows them. */
export const SHORTCUT_GROUPS: readonly ShortcutGroup[] = ["Go to", "Actions"];

/** Keys waiting for a follow-up, e.g. `["g"]` after pressing G. */
export type Pending = readonly string[];

/** `KeyboardEvent.key` → the token used in the table above. */
export function normalizeKey(key: string): string {
  return key === " " ? "space" : key.toLowerCase();
}

function matches(keys: readonly string[], pressed: readonly string[]): boolean {
  return keys.length === pressed.length && keys.every((key, index) => key === pressed[index]);
}

function startsWith(keys: readonly string[], pressed: readonly string[]): boolean {
  return pressed.every((key, index) => keys[index] === key);
}

/**
 * Resolve one key press.
 *
 * Returns the shortcut to run (if the press completed one) and whatever should
 * be remembered for the next press. An unrecognized key — or a sequence that
 * cannot continue — clears the pending keys, so a mistyped prefix does not
 * swallow the next command.
 */
export function resolveShortcut(
  pending: Pending,
  key: string,
): { shortcut: Shortcut | null; pending: Pending } {
  const pressed = [...pending, key];

  const exact = SHORTCUTS.find((shortcut) => matches(shortcut.keys, pressed));
  if (exact) return { shortcut: exact, pending: [] };

  const couldContinue = SHORTCUTS.some(
    (shortcut) => shortcut.keys.length > pressed.length && startsWith(shortcut.keys, pressed),
  );
  if (couldContinue) return { shortcut: null, pending: pressed };

  return { shortcut: null, pending: [] };
}

/** Readable form for screen readers: `["g", "t"]` → `"g then t"`. */
export function keysLabel(keys: readonly string[]): string {
  return keys.join(" then ");
}

/** The table, grouped for the help dialog. */
export function groupedShortcuts(): { group: ShortcutGroup; items: Shortcut[] }[] {
  return SHORTCUT_GROUPS.map((group) => ({
    group,
    items: SHORTCUTS.filter((shortcut) => shortcut.group === group),
  }));
}
