/**
 * Versioned JSON backup format.
 *
 * The whole file is validated and cross-checked *before* anything touches the
 * database. Validation is pure so the settings page can show a summary (and any
 * problems) to the user for confirmation first.
 */

import { z } from "zod";

import { DATE_ONLY_PATTERN, isValidDateOnly, isValidTimeZone } from "@/lib/dates";
import { NOTES_MAX_LENGTH, NAME_MAX_LENGTH, TITLE_MAX_LENGTH } from "@/lib/constants";

export const BACKUP_FORMAT = "kairos-backup";
export const BACKUP_VERSION = 1;

const dateOnly = z
  .string()
  .regex(DATE_ONLY_PATTERN, "Dates must use the YYYY-MM-DD format.")
  .refine(isValidDateOnly, "Invalid calendar date.");

const timestamp = z.string().refine((value) => !Number.isNaN(Date.parse(value)), {
  message: "Invalid timestamp.",
});

const nullableDateOnly = z.union([dateOnly, z.null()]);
const nullableTimestamp = z.union([timestamp, z.null()]);

export const backupCategorySchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(NAME_MAX_LENGTH),
  color: z.string().min(1).max(32),
  position: z.number().int(),
  createdAt: timestamp.optional(),
});

export const backupLabelSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(NAME_MAX_LENGTH),
  color: z.string().min(1).max(32),
});

export const backupTaskSchema = z.object({
  id: z.string().min(1).max(64),
  title: z.string().min(1).max(TITLE_MAX_LENGTH),
  notes: z.string().max(NOTES_MAX_LENGTH).nullable().optional(),
  status: z.enum(["TODO", "DONE"]),
  priority: z.enum(["NONE", "LOW", "MEDIUM", "HIGH"]),
  categoryId: z.string().max(64).nullable().optional(),
  parentId: z.string().max(64).nullable().optional(),
  scheduledDate: nullableDateOnly.optional(),
  dueDate: nullableDateOnly.optional(),
  position: z.number().int(),
  createdAt: timestamp.optional(),
  updatedAt: timestamp.optional(),
  completedAt: nullableTimestamp.optional(),
});

export const backupTaskLabelSchema = z.object({
  taskId: z.string().min(1).max(64),
  labelId: z.string().min(1).max(64),
});

export const backupEventSchema = z.object({
  id: z.string().min(1).max(64).optional(),
  taskId: z.string().max(64).nullable().optional(),
  action: z.string().min(1).max(40),
  timestamp,
  metadata: z.string().max(2000).nullable().optional(),
});

export const backupSettingsSchema = z.object({
  theme: z.enum(["light", "dark", "system"]),
  timezone: z.string().min(1).refine(isValidTimeZone, "Unknown timezone."),
  weekStartsOn: z.number().int().min(0).max(6),
});

export const backupDataSchema = z.object({
  settings: backupSettingsSchema,
  categories: z.array(backupCategorySchema).max(500),
  labels: z.array(backupLabelSchema).max(1000),
  tasks: z.array(backupTaskSchema).max(50000),
  taskLabels: z.array(backupTaskLabelSchema).max(200000).optional(),
  events: z.array(backupEventSchema).max(500000).optional(),
});

export const backupFileSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  version: z.literal(BACKUP_VERSION),
  exportedAt: timestamp.optional(),
  data: backupDataSchema,
});

export type BackupFile = z.infer<typeof backupFileSchema>;
export type BackupTask = z.infer<typeof backupTaskSchema>;
export type BackupCategory = z.infer<typeof backupCategorySchema>;
export type BackupLabel = z.infer<typeof backupLabelSchema>;
export type BackupEvent = z.infer<typeof backupEventSchema>;
export type BackupTaskLabel = z.infer<typeof backupTaskLabelSchema>;

export type BackupSummary = {
  version: number;
  exportedAt: string | null;
  tasks: number;
  subtasks: number;
  completedTasks: number;
  categories: number;
  labels: number;
  taskLabels: number;
  events: number;
  timezone: string;
  theme: string;
  weekStartsOn: number;
  warnings: string[];
};

export type BackupValidation =
  | { ok: true; data: BackupFile; summary: BackupSummary }
  | { ok: false; errors: string[] };

/**
 * Validate a parsed backup object, including every cross-reference between
 * tasks, subtasks, categories and labels.
 */
export function validateBackup(raw: unknown): BackupValidation {
  const parsed = backupFileSchema.safeParse(raw);
  if (!parsed.success) {
    const errors = parsed.error.issues
      .slice(0, 25)
      .map((issue) => `${issue.path.join(".") || "file"}: ${issue.message}`);
    return { ok: false, errors };
  }

  const data = parsed.data.data;
  const errors: string[] = [];
  const warnings: string[] = [];

  const categoryIds = new Set<string>();
  for (const category of data.categories) {
    if (categoryIds.has(category.id)) {
      errors.push(`Duplicate category id "${category.id}".`);
    }
    categoryIds.add(category.id);
  }

  const labelIds = new Set<string>();
  for (const label of data.labels) {
    if (labelIds.has(label.id)) errors.push(`Duplicate label id "${label.id}".`);
    labelIds.add(label.id);
  }

  const taskById = new Map<string, BackupTask>();
  for (const task of data.tasks) {
    if (taskById.has(task.id)) errors.push(`Duplicate task id "${task.id}".`);
    taskById.set(task.id, task);
  }

  // Parent references, cycles and nesting depth.
  for (const task of data.tasks) {
    if (task.parentId) {
      if (task.parentId === task.id) {
        errors.push(`Task "${task.id}" is its own parent.`);
        continue;
      }
      const parent = taskById.get(task.parentId);
      if (!parent) {
        errors.push(`Task "${task.id}" references missing parent "${task.parentId}".`);
        continue;
      }
      if (parent.parentId) {
        errors.push(
          `Task "${task.id}" is nested under subtask "${parent.id}" — only one nesting level is allowed.`,
        );
      }
      if (parent.categoryId !== task.categoryId) {
        warnings.push(
          `Subtask "${task.id}" did not match its parent's category and was moved to the parent's category.`,
        );
      }
    }
    if (task.categoryId && !categoryIds.has(task.categoryId)) {
      errors.push(`Task "${task.id}" references missing category "${task.categoryId}".`);
    }
    if (task.status === "DONE" && !task.completedAt) {
      warnings.push(`Completed task "${task.id}" had no completion time; one was added.`);
    }
  }

  // Cycle detection over the parent links.
  const seen = new Set<string>();
  const inProgress = new Set<string>();
  const walk = (id: string): boolean => {
    if (inProgress.has(id)) return false;
    if (seen.has(id)) return true;
    inProgress.add(id);
    const task = taskById.get(id);
    if (task?.parentId && taskById.has(task.parentId)) {
      if (!walk(task.parentId)) return false;
    }
    inProgress.delete(id);
    seen.add(id);
    return true;
  };
  for (const task of data.tasks) {
    if (!walk(task.id)) {
      errors.push(`Parent links form a cycle at task "${task.id}".`);
      break;
    }
  }

  const taskLabels = data.taskLabels ?? [];
  const seenPairs = new Set<string>();
  for (const pair of taskLabels) {
    if (!taskById.has(pair.taskId)) {
      errors.push(`Label assignment references missing task "${pair.taskId}".`);
    }
    if (!labelIds.has(pair.labelId)) {
      errors.push(`Label assignment references missing label "${pair.labelId}".`);
    }
    const key = `${pair.taskId}::${pair.labelId}`;
    if (seenPairs.has(key)) {
      errors.push(`Duplicate label assignment for task "${pair.taskId}".`);
    }
    seenPairs.add(key);
  }

  const events = data.events ?? [];
  for (const event of events) {
    if (event.taskId && !taskById.has(event.taskId)) {
      warnings.push(
        `Event "${event.id ?? event.action}" referenced a missing task and was kept without a task link.`,
      );
    }
  }

  if (errors.length > 0) return { ok: false, errors };

  const subtasks = data.tasks.filter((task) => task.parentId !== null).length;
  const completedTasks = data.tasks.filter((task) => task.status === "DONE").length;

  return {
    ok: true,
    data: parsed.data,
    summary: {
      version: parsed.data.version,
      exportedAt: parsed.data.exportedAt ?? null,
      tasks: data.tasks.length - subtasks,
      subtasks,
      completedTasks,
      categories: data.categories.length,
      labels: data.labels.length,
      taskLabels: taskLabels.length,
      events: events.length,
      timezone: data.settings.timezone,
      theme: data.settings.theme,
      weekStartsOn: data.settings.weekStartsOn,
      warnings: [...new Set(warnings)].slice(0, 10),
    },
  };
}

/** Validate raw JSON text (used by the import preview). */
export function parseBackupText(text: string): BackupValidation {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, errors: ["The file is not valid JSON."] };
  }
  return validateBackup(parsed);
}

/** Build the export payload from already-loaded database rows. */
export function buildBackupFile(input: {
  settings: { theme: string; timezone: string; weekStartsOn: number };
  categories: Array<{
    id: string;
    name: string;
    color: string;
    position: number;
    createdAt: Date;
  }>;
  labels: Array<{ id: string; name: string; color: string }>;
  tasks: Array<{
    id: string;
    title: string;
    notes: string | null;
    status: string;
    priority: string;
    categoryId: string | null;
    parentId: string | null;
    scheduledDate: Date | null;
    dueDate: Date | null;
    position: number;
    createdAt: Date;
    updatedAt: Date;
    completedAt: Date | null;
  }>;
  taskLabels: Array<{ taskId: string; labelId: string }>;
  events: Array<{
    id: string;
    taskId: string | null;
    action: string;
    timestamp: Date;
    metadata: string | null;
  }>;
  now?: Date;
}): BackupFile {
  const dateOnly = (value: Date | null) => (value ? value.toISOString().slice(0, 10) : null);

  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: (input.now ?? new Date()).toISOString(),
    data: {
      settings: {
        theme: input.settings.theme as BackupFile["data"]["settings"]["theme"],
        timezone: input.settings.timezone,
        weekStartsOn: input.settings.weekStartsOn,
      },
      categories: input.categories.map((category) => ({
        id: category.id,
        name: category.name,
        color: category.color,
        position: category.position,
        createdAt: category.createdAt.toISOString(),
      })),
      labels: input.labels,
      tasks: input.tasks.map((task) => ({
        id: task.id,
        title: task.title,
        notes: task.notes,
        status: task.status as BackupTask["status"],
        priority: task.priority as BackupTask["priority"],
        categoryId: task.categoryId,
        parentId: task.parentId,
        scheduledDate: dateOnly(task.scheduledDate),
        dueDate: dateOnly(task.dueDate),
        position: task.position,
        createdAt: task.createdAt.toISOString(),
        updatedAt: task.updatedAt.toISOString(),
        completedAt: task.completedAt ? task.completedAt.toISOString() : null,
      })),
      taskLabels: input.taskLabels,
      events: input.events.map((event) => ({
        id: event.id,
        taskId: event.taskId,
        action: event.action,
        timestamp: event.timestamp.toISOString(),
        metadata: event.metadata,
      })),
    },
  };
}
