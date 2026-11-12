/**
 * Keyboard shortcuts.
 *
 * Pure and dependency-free, so the matching rules can be tested without a DOM —
 * the listener that feeds them lives in `ShortcutProvider`.
 *
 * Two shapes exist:
 *
 * - a **modifier combo**, written `["shift", "t"]` — Shift held plus a key;
 * - a **sequence**, written `["g", "t"]` — one key, then another. The resolver
 *   still supports this, but the default table does not use it.
 *
 * `keyTokens` is the only thing that turns a keyboard event into tokens, because
 * `KeyboardEvent.key` alone cannot express Shift: Shift+T arrives as `"T"` and
 * normalises to `"t"`. Punctuation is the exception — `?` is already what
 * Shift+/ produces, so it is bound as a single token.
 */
export type ShortcutId =
  | "go-today"
  | "go-tasks"
  | "go-completed"
  | "go-habits"
  | "go-statistics"
  | "go-settings"
  | "search"
  | "new-task"
  | "toggle-theme"
  | "help";

export type ShortcutGroup = "Go to" | "Actions";

export type Shortcut = {
  id: ShortcutId;
  /**
   * The tokens this shortcut needs, in order.
   *
   * `["t"]` is a plain key. `["shift", "t"]` is Shift + T — a leading modifier
   * token is matched against the modifier, not against a key press.
   */
  keys: readonly string[];
  label: string;
  group: ShortcutGroup;
};

export const SHORTCUTS: readonly Shortcut[] = [
  // Go to — Shift + letter. One modifier, one key, no waiting for a second
  // press, so navigation is immediate.
  { id: "go-today", keys: ["shift", "t"], label: "Today", group: "Go to" },
  { id: "go-tasks", keys: ["shift", "a"], label: "All Tasks", group: "Go to" },
  { id: "go-completed", keys: ["shift", "c"], label: "Completed", group: "Go to" },
  { id: "go-habits", keys: ["shift", "h"], label: "Habits", group: "Go to" },
  { id: "go-statistics", keys: ["shift", "s"], label: "Statistics", group: "Go to" },
  { id: "go-settings", keys: ["shift", "i"], label: "Settings", group: "Go to" },

  // Actions — one unmodified key. `t` and `Shift+T` are different bindings, so
  // toggling the theme does not navigate away.
  { id: "search", keys: ["/"], label: "Filter tasks on this page", group: "Actions" },
  { id: "new-task", keys: ["n"], label: "New task", group: "Actions" },
  { id: "toggle-theme", keys: ["t"], label: "Switch theme", group: "Actions" },
  // `?` is Shift+/ on most layouts, but `event.key` already reports `?` — see
  // `keyTokens`, which deliberately does not add a `shift` token to punctuation.
  { id: "help", keys: ["?"], label: "Keyboard shortcuts", group: "Actions" },
];

/** How long the first key of a sequence waits for its second. */
export const SEQUENCE_TIMEOUT_MS = 1200;

/** Groups in the order the help dialog shows them. */
export const SHORTCUT_GROUPS: readonly ShortcutGroup[] = ["Go to", "Actions"];

/** Keys waiting for a follow-up, e.g. `["g"]` after pressing G. */
export type Pending = readonly string[];

/** Modifier tokens `keyTokens` can produce, in the order they are written. */
export const MODIFIER_TOKENS = ["shift"] as const;

export function isModifierToken(token: string): boolean {
  return (MODIFIER_TOKENS as readonly string[]).includes(token);
}

/** `KeyboardEvent.key` → the token used in the table above. */
export function normalizeKey(key: string): string {
  return key === " " ? "space" : key.toLowerCase();
}

/**
 * The token(s) one key press contributes.
 *
 * Shift is named only when it produced a **letter**, because that is the only case
 * `KeyboardEvent.key` hides: `Shift+T` reports `"T"`, which normalises to the same
 * `"t"` as the unshifted key. For punctuation the shifted character already *is*
 * the key (`?`), and for named keys (`Escape`) the modifier is irrelevant — naming
 * it there would make `Shift+/` impossible to bind.
 */
export function keyTokens(event: { key: string; shiftKey?: boolean }): string[] {
  const key = normalizeKey(event.key);
  if (event.shiftKey && /^[a-z]$/.test(key)) return ["shift", key];
  return [key];
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
  key: string | readonly string[],
): { shortcut: Shortcut | null; pending: Pending } {
  const pressed = [...pending, ...(typeof key === "string" ? [key] : key)];

  const exact = SHORTCUTS.find((shortcut) => matches(shortcut.keys, pressed));
  if (exact) return { shortcut: exact, pending: [] };

  const couldContinue = SHORTCUTS.some(
    (shortcut) => shortcut.keys.length > pressed.length && startsWith(shortcut.keys, pressed),
  );
  if (couldContinue) return { shortcut: null, pending: pressed };

  return { shortcut: null, pending: [] };
}

/**
 * Readable form for the help dialog.
 *
 * A combo reads `Shift + T`; a sequence reads `g then t`. The two are never mixed
 * in the table, but the helper handles both rather than assuming.
 */
export function keysLabel(keys: readonly string[]): string {
  if (keys.length > 0 && isModifierToken(keys[0])) {
    return keys
      .map((token) => (isModifierToken(token) ? "Shift" : token.toUpperCase()))
      .join(" + ");
  }
  return keys.join(" then ");
}

/** The table, grouped for the help dialog. */
export function groupedShortcuts(): { group: ShortcutGroup; items: Shortcut[] }[] {
  return SHORTCUT_GROUPS.map((group) => ({
    group,
    items: SHORTCUTS.filter((shortcut) => shortcut.group === group),
  }));
}
