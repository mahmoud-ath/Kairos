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
 * Returns `undefined` for an ordinary task, because only habit instances carry a
 * day. Typed so the writer and `buildHabitCompletionLog` cannot disagree about the
 * field names.
 */
export function habitCompletionMetadata(task: {
  habitId: string | null;
  habitDate: string | null;
}): HabitDayMetadata | undefined {
  if (!task.habitId || !task.habitDate) return undefined;
  if (!DATE_ONLY.test(task.habitDate)) return undefined;
  return { habitId: task.habitId, habitDate: task.habitDate };
}

/* -------------------------------------------------------------------------- */
/* What a writer may record                                                   */
/* -------------------------------------------------------------------------- */

/**
 * One event, as a writer describes it.
 *
 * Discriminated by `action`, so a payload that does not belong to its action is a
 * compile error: `{ action: "completed", count: 2 }` cannot be written, and a
 * habit completion has to name a habit **day** rather than two loose strings.
 *
 * The serialised JSON is unchanged from before this type existed — readers parse
 * it with `parseTaskEventMetadata`, and rows written by older versions keep
 * working (see the `date` alias above).
 */
export type TaskEventDetails =
  | {
      action: "created";
      taskId?: string | null;
      parentId?: string | null;
      restored?: true;
      example?: true;
    }
  | { action: "updated"; taskId?: string | null; fields: readonly string[] }
  | {
      action: "completed" | "reopened";
      taskId?: string | null;
      /** Set when the event belongs to a habit's generated instance. */
      habitDay?: HabitDayMetadata;
      /** Set when a subtask was toggled on its own. */
      parentId?: string | null;
      subtask?: true;
      example?: true;
    }
  | {
      action: "subtask_completed" | "subtask_reopened";
      taskId?: string | null;
      count: number;
      via: "parent";
    }
  | {
      action: "deleted";
      taskId?: string | null;
      title?: string;
      subtasks?: number;
      cleared?: number;
      titles?: readonly string[];
    }
  | {
      action: "moved";
      taskId?: string | null;
      categoryId?: string | null;
      parentId?: string | null;
      scheduledDate?: string | null;
      index?: number;
    };

/**
 * Flatten a writer's description into the JSON that is stored.
 *
 * `habitDay` is the only nested field: it expands back into the `habitId` /
 * `habitDate` pair the readers already understand. `taskId` is always written,
 * because `TaskEvent.taskId` goes null when the task is deleted and the daily
 * charts still need to count it once per day.
 */
export function metadataFromDetails(event: TaskEventDetails): Record<string, unknown> {
  const metadata: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(event)) {
    if (key === "action" || key === "taskId" || value === undefined) continue;
    if (key === "habitDay") {
      const day = value as HabitDayMetadata;
      metadata.habitId = day.habitId;
      metadata.habitDate = day.habitDate;
      continue;
    }
    metadata[key] = value;
  }

  metadata.taskId = event.taskId ?? null;
  return metadata;
}
