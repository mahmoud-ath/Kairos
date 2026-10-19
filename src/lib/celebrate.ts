/**
 * Wording for the completion celebration.
 *
 * Pure and dependency-free, so the copy — including the truncation rule that
 * stops a 200-character title from taking over the corner of the screen — can be
 * tested without a DOM. The toast that shows it lives in
 * `components/tasks/celebration.ts`.
 */

export type CompletionKind = "task" | "subtask" | "habit";

export type CompletionMessage = {
  /** The headline, e.g. "Well done!". */
  title: string;
  /** One line naming what was finished. */
  description: string;
};

/** Headlines per kind: a subtask is progress, a habit day is a streak. */
export const COMPLETION_TITLE: Record<CompletionKind, string> = {
  task: "Well done!",
  subtask: "Nice work!",
  habit: "Streak kept!",
};

/** A toast is a glance, not a list of everything you typed. */
export const CELEBRATION_TITLE_MAX_LENGTH = 48;

const FALLBACK_TITLE: Record<CompletionKind, string> = {
  task: "a task",
  subtask: "a subtask",
  habit: "a habit",
};

/**
 * The task's title, squeezed onto one line and capped.
 *
 * Whitespace is collapsed because a title may legitimately contain newlines and
 * a toast renders them as a wall of text.
 */
export function shortTitle(kind: CompletionKind, title: string): string {
  const clean = title.trim().replace(/\s+/g, " ");
  if (!clean) return FALLBACK_TITLE[kind];
  if (clean.length <= CELEBRATION_TITLE_MAX_LENGTH) return clean;
  return `${clean.slice(0, CELEBRATION_TITLE_MAX_LENGTH - 1).trimEnd()}…`;
}

/** What the completion toast says, for a task, a subtask or a habit day. */
export function completionMessage(
  kind: CompletionKind,
  title: string,
): CompletionMessage {
  const quoted = `“${shortTitle(kind, title)}”`;
  switch (kind) {
    case "subtask":
      return {
        title: COMPLETION_TITLE.subtask,
        description: `Subtask ${quoted} is done.`,
      };
    case "habit":
      return {
        title: COMPLETION_TITLE.habit,
        description: `${quoted} is done for today.`,
      };
    default:
      return {
        title: COMPLETION_TITLE.task,
        description: `You completed ${quoted}.`,
      };
  }
}
