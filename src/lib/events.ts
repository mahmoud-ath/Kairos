/**
 * The shape of a `TaskEvent` payload — the agreement between writers and readers.
 *
 * `TaskEvent.metadata` is a JSON column, so nothing in the database stops a
 * writer from storing `habitDate` while a reader looks for `date`. That happened
 * in the tracker: a completion written under one name is invisible to a reader
 * looking for another, and the day silently disappears from the history.
 *
 * This module is the single place that answers "what is in this payload?":
 *
 * - writers build payloads from the typed helpers here,
 * - readers go through `parseTaskEventMetadata`, which **never throws** and
 *   **never discards** a field it does not recognise (`extra` keeps it),
 * - older names are accepted as aliases, so history written by previous versions
 *   keeps counting. That is deliberate: "safer parsing" must not make valid
 *   history disappear.
 */

export type TaskEventAction =
  | "created"
  | "updated"
  | "completed"
  | "reopened"
  | "deleted"
  | "moved"
  | "subtask_completed"
  | "subtask_reopened";

/** `YYYY-MM-DD`. Kept here rather than imported, so this module stays leaf-level. */
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** A habit day named by an event: the habit, and the day it belonged to. */
export type HabitDayMetadata = {
  habitId: string;
  habitDate: string;
};

export type TaskEventMetadata = {
  /** The task this event is about; survives the task's deletion (see below). */
  taskId: string | null;
  parentId: string | null;
  /** Set on the generated instance of a habit (kind `habit`). */
  habitId: string | null;
  habitDate: string | null;
  /** How many subtasks a cascade completed / reopened. */
  count: number | null;
  /** Why an event was written, e.g. `"parent"`. */
  via: string | null;
  /**
   * Everything else the writer recorded, untouched. Readers that care about a
   * newer field can read it from here until it is promoted to a named field;
   * nothing is lost by parsing.
   */
  extra: Record<string, unknown>;
};

const EMPTY: TaskEventMetadata = {
  taskId: null,
  parentId: null,
  habitId: null,
  habitDate: null,
  count: null,
  via: null,
  extra: {},
};

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

const NAMED_FIELDS = new Set([
  "taskId",
  "parentId",
  "habitId",
  "habitDate",
  "count",
  "via",
  // Legacy alias, see below.
  "date",
]);

/**
 * Read a stored payload. Never throws, never returns `null`.
 *
 * A malformed or missing payload reads as all-null with no extras, which is what
 * every reader already treated as "nothing to count".
 */
export function parseTaskEventMetadata(raw: string | null | undefined): TaskEventMetadata {
  if (!raw) return EMPTY;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return EMPTY;
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return EMPTY;

  const record = parsed as Record<string, unknown>;

  // `date` is the older name for `habitDate`. Accepting both keeps rows written
  // before the rename in the history instead of dropping them.
  const habitDate = asString(record.habitDate) ?? asString(record.date);

  const extra: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (!NAMED_FIELDS.has(key)) extra[key] = value;
  }

  return {
    taskId: asString(record.taskId),
    parentId: asString(record.parentId),
    habitId: asString(record.habitId),
    habitDate: habitDate !== null && DATE_ONLY.test(habitDate) ? habitDate : null,
    count: asNumber(record.count),
    via: asString(record.via),
    extra,
  };
}

/**
 * The habit day an event records, or `null` when it does not record one.
 *
 * Both halves are required: an id without a valid date cannot be placed on the
 * calendar, and a date without an id cannot be attributed.
 */
export function habitDayOf(metadata: TaskEventMetadata): HabitDayMetadata | null {
  if (metadata.habitId === null) return null;
  if (metadata.habitDate === null) return null;
  return { habitId: metadata.habitId, habitDate: metadata.habitDate };
}

/** True when the event was written for a habit's generated task. */
export function isHabitEventMetadata(metadata: TaskEventMetadata): boolean {
  return metadata.habitId !== null;
}

/**
 * A payload for "this habit instance was (un)completed on this day".
 *
 * Returns `{}` for an ordinary task, because only habit instances carry a day.
 * Typed so the writer and `buildHabitCompletionLog` cannot disagree about the
 * field names.
 */
export function habitCompletionMetadata(task: {
  habitId: string | null;
  habitDate: string | null;
}): HabitDayMetadata | Record<string, never> {
  if (!task.habitId || !task.habitDate) return {};
  if (!DATE_ONLY.test(task.habitDate)) return {};
  return { habitId: task.habitId, habitDate: task.habitDate };
}
