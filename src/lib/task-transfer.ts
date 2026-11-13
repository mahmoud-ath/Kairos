/**
 * Task-only JSON transfer format.
 *
 * The settings page owns the *full workspace* backup (see `lib/backup.ts`); this
 * format exists for the narrower job the top bar offers: move a set of tasks and
 * their subtasks out of one workspace and into another.
 *
 * It is deliberately **not** a backup format:
 *
 * - no ids — an import always creates new rows, so a file can be imported twice
 *   and into a workspace that already holds the same tasks;
 * - no settings, habits, events or history — a transferred task keeps its
 *   category *by name* (matched against the destination workspace), not by id;
 * - nested subtasks, because the app has exactly one level of nesting.
 *
 * Validation is pure, so the client can preview a file before deciding to import
 * it and the server can re-validate the same text on the way in.
 */

import { z } from "zod";

import {
  NAME_MAX_LENGTH,
  NOTES_MAX_LENGTH,
  TITLE_MAX_LENGTH,
} from "@/lib/constants";
import { DATE_ONLY_PATTERN, isValidDateOnly } from "@/lib/dates";

export const TASK_TRANSFER_FORMAT = "kairos-tasks";
export const TASK_TRANSFER_VERSION = 1;

/** A file larger than this is refused before it is parsed. */
export const TASK_TRANSFER_MAX_BYTES = 20_000_000;
export const TASK_TRANSFER_MAX_TASKS = 5_000;
export const TASK_TRANSFER_MAX_SUBTASKS = 100;

const dateOnly = z
  .string()
  .regex(DATE_ONLY_PATTERN, "Dates must use the YYYY-MM-DD format.")
  .refine(isValidDateOnly, "Invalid calendar date.");

const timestamp = z.string().refine((value) => !Number.isNaN(Date.parse(value)), {
  message: "Invalid timestamp.",
});

const nullableDateOnly = z.union([dateOnly, z.null()]).optional();
const nullableTimestamp = z.union([timestamp, z.null()]).optional();

export const transferSubtaskSchema = z.object({
  title: z.string().trim().min(1, "A subtask needs a title.").max(TITLE_MAX_LENGTH),
  status: z.enum(["TODO", "DONE"]).optional(),
  completedAt: nullableTimestamp,
});

export const transferTaskSchema = z.object({
  title: z.string().trim().min(1, "A task needs a title.").max(TITLE_MAX_LENGTH),
  notes: z.string().max(NOTES_MAX_LENGTH).nullable().optional(),
  status: z.enum(["TODO", "DONE"]).optional(),
  /** Category *name* in the destination workspace; `null` means uncategorized. */
  category: z.string().trim().max(NAME_MAX_LENGTH).nullable().optional(),
  scheduledDate: nullableDateOnly,
  dueDate: nullableDateOnly,
  completedAt: nullableTimestamp,
  subtasks: z.array(transferSubtaskSchema).max(TASK_TRANSFER_MAX_SUBTASKS).optional(),
});

export const transferFileSchema = z.object({
  format: z.literal(TASK_TRANSFER_FORMAT),
  version: z.literal(TASK_TRANSFER_VERSION),
  exportedAt: timestamp.optional(),
  tasks: z
    .array(transferTaskSchema)
    .min(1, "The file contains no tasks.")
    .max(TASK_TRANSFER_MAX_TASKS),
});

export type TransferSubtask = z.infer<typeof transferSubtaskSchema>;
export type TransferTask = z.infer<typeof transferTaskSchema>;
export type TaskTransferFile = z.infer<typeof transferFileSchema>;

export type TaskTransferSummary = {
  exportedAt: string | null;
  /** Top-level tasks in the file. */
  tasks: number;
  subtasks: number;
  completed: number;
  /** Category names the file mentions, in first-seen order. */
  categories: string[];
};

export type TaskTransferValidation =
  | { ok: true; data: TaskTransferFile; summary: TaskTransferSummary }
  | { ok: false; errors: string[] };

/**
 * Validate a parsed transfer object.
 *
 * Only shape and content are checked here; categories are resolved against the
 * *destination* workspace at import time, so a file from another account imports
 * without its categories having to exist beforehand.
 */
export function validateTaskTransfer(raw: unknown): TaskTransferValidation {
  const parsed = transferFileSchema.safeParse(raw);
  if (!parsed.success) {
    const errors = parsed.error.issues
      .slice(0, 10)
      .map((issue) => `${issue.path.join(".") || "file"}: ${issue.message}`);
    return { ok: false, errors };
  }

  const file = parsed.data;
  const categories: string[] = [];
  let subtasks = 0;
  let completed = 0;

  for (const task of file.tasks) {
    if (task.status === "DONE") completed += 1;
    subtasks += task.subtasks?.length ?? 0;
    completed += task.subtasks?.filter((subtask) => subtask.status === "DONE").length ?? 0;
    const name = task.category?.trim();
    if (name && !categories.includes(name)) categories.push(name);
  }

  return {
    ok: true,
    data: file,
    summary: {
      exportedAt: file.exportedAt ?? null,
      tasks: file.tasks.length,
      subtasks,
      completed,
      categories,
    },
  };
}

/** Validate the text form of a transfer file (what a file picker hands over). */
export function parseTaskTransferText(text: string): TaskTransferValidation {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, errors: ["The selected file is not valid JSON."] };
  }
  return validateTaskTransfer(parsed);
}

/** Build a transfer file from already-serialized tasks. */
export function buildTaskTransferFile(
  tasks: TransferTask[],
  exportedAt: string = new Date().toISOString(),
): TaskTransferFile {
  return {
    format: TASK_TRANSFER_FORMAT,
    version: TASK_TRANSFER_VERSION,
    exportedAt,
    tasks,
  };
}
