/**
 * Zod schemas for every Server Action input.
 *
 * Server Actions are public HTTP endpoints, so nothing that arrives from the
 * client is trusted: ids, text lengths, dates, enums and relationship fields are
 * all validated here before they reach the database layer.
 */

import { z } from "zod";

import { isAvatarId } from "@/lib/avatars";
import { isCategoryIconName } from "@/lib/category-icons";
import {
  NAME_MAX_LENGTH,
  NICKNAME_MAX_LENGTH,
  NOTES_MAX_LENGTH,
  TITLE_MAX_LENGTH,
} from "@/lib/constants";
import { DATE_ONLY_PATTERN, isValidDateOnly, isValidTimeZone } from "@/lib/dates";
import type { TaskStatus } from "@/types/kairos";

export const taskStatusSchema = z.enum(["TODO", "DONE"]);
export const themeSchema = z.enum(["light", "dark", "system"]);
// Mirrors the `FontScale` union; the percentages live in FONT_SCALES.
export const fontScaleSchema = z.enum(["compact", "default", "large", "larger"]);

export const idSchema = z
  .string()
  .trim()
  .min(1, "Missing id.")
  .max(64, "Invalid id.");

export const dateOnlySchema = z
  .string()
  .trim()
  .regex(DATE_ONLY_PATTERN, "Dates must use the YYYY-MM-DD format.")
  .refine(isValidDateOnly, "That is not a valid calendar date.");

/** `null` / `""` / `undefined` all mean "not set". */
export const optionalDateOnlySchema = z
  .union([dateOnlySchema, z.literal(""), z.null(), z.undefined()])
  .transform((value) => (value ? value : null));

export const optionalIdSchema = z
  .union([idSchema, z.literal(""), z.null(), z.undefined()])
  .transform((value) => (value ? value : null));

export const titleSchema = z
  .string()
  .trim()
  .min(1, "A task needs a title.")
  .max(TITLE_MAX_LENGTH, `Titles are limited to ${TITLE_MAX_LENGTH} characters.`);

export const notesSchema = z
  .union([
    z.string().max(NOTES_MAX_LENGTH, `Notes are limited to ${NOTES_MAX_LENGTH} characters.`),
    z.null(),
    z.undefined(),
  ])
  .transform((value) => {
    if (value === null || value === undefined) return null;
    const trimmed = value.trim();
    return trimmed === "" ? null : trimmed;
  });

export const nameSchema = z
  .string()
  .trim()
  .min(1, "A name is required.")
  .max(NAME_MAX_LENGTH, `Names are limited to ${NAME_MAX_LENGTH} characters.`);

export const colorSchema = z
  .string()
  .trim()
  .regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "Colors must be hex values like #f97316.");

export const positionSchema = z.number().int().min(0).max(100000);

/** `""` and `null` both mean "no nickname" — the UI then derives one. */
export const nicknameSchema = z
  .union([
    z
      .string()
      .trim()
      .max(
        NICKNAME_MAX_LENGTH,
        `Nicknames are limited to ${NICKNAME_MAX_LENGTH} characters.`,
      ),
    z.null(),
  ])
  .transform((value) => (value && value.length > 0 ? value : null));

/** Only ids from the avatar catalogue are accepted. */
export const avatarIdSchema = z.string().refine(isAvatarId, "Unknown avatar.");

/** Only names from the category icon catalogue are accepted. */
export const categoryIconSchema = z.string().refine(isCategoryIconName, "Unknown icon.");

/* -------------------------------------------------------------------------- */
/* Tasks                                                                      */
/* -------------------------------------------------------------------------- */

export const createTaskInputSchema = z.object({
  /**
   * Optional client-supplied id.
   *
   * The UI renders an optimistic task before the server answers; letting the
   * client pick the id means acting on that row (ticking a subtask straight
   * after typing it) targets the real record instead of a placeholder.
   */
  id: idSchema.optional(),
  title: titleSchema,
  notes: notesSchema.optional(),
  categoryId: optionalIdSchema.optional(),
  parentId: optionalIdSchema.optional(),
  scheduledDate: optionalDateOnlySchema.optional(),
  dueDate: optionalDateOnlySchema.optional(),
});

export type CreateTaskInput = z.input<typeof createTaskInputSchema>;
export type CreateTaskValues = z.output<typeof createTaskInputSchema>;

export const updateTaskInputSchema = z
  .object({
    id: idSchema,
    title: titleSchema.optional(),
    notes: notesSchema.optional(),
    categoryId: optionalIdSchema.optional(),
    parentId: optionalIdSchema.optional(),
    scheduledDate: optionalDateOnlySchema.optional(),
    dueDate: optionalDateOnlySchema.optional(),
    status: taskStatusSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 1, "Nothing to update.");

export type UpdateTaskInput = z.input<typeof updateTaskInputSchema>;
export type UpdateTaskValues = z.output<typeof updateTaskInputSchema>;

export const taskIdSchema = z.object({ id: idSchema });

export const setTaskStatusSchema = z.object({
  id: idSchema,
  status: taskStatusSchema,
});

export const restoreTaskSchema = z.object({
  id: idSchema,
  title: titleSchema,
  notes: notesSchema.optional(),
  status: taskStatusSchema.optional(),
  categoryId: optionalIdSchema.optional(),
  scheduledDate: optionalDateOnlySchema.optional(),
  dueDate: optionalDateOnlySchema.optional(),
  position: z.number().int().optional(),
  subtasks: z
    .array(
      z.object({
        id: idSchema,
        title: titleSchema,
        status: taskStatusSchema,
        position: z.number().int().min(0).max(100000),
      }),
    )
    .max(200)
    .optional(),
});

/** Move a task inside its sibling group, optionally changing its planned day. */
export const reorderTaskSchema = z.object({
  id: idSchema,
  parentId: optionalIdSchema,
  /** Target planned-date group (`null` = unscheduled). */
  scheduledDate: optionalDateOnlySchema.optional(),
  /** Index inside the destination group. */
  targetIndex: z.number().int().min(0).max(10000),
});

/** Move a task to another category, under (or out of) a parent, or onto a day. */
export const moveTaskSchema = z.object({
  id: idSchema,
  parentId: optionalIdSchema.optional(),
  categoryId: optionalIdSchema.optional(),
  scheduledDate: optionalDateOnlySchema.optional(),
});

export const moveTaskToCategorySchema = z.object({
  id: idSchema,
  categoryId: optionalIdSchema,
});

export const clearCompletedSchema = z.object({
  scope: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("all") }),
    z.object({ kind: z.literal("category"), categoryId: idSchema }),
  ]),
});

/* -------------------------------------------------------------------------- */
/* Categories                                                                 */
/* -------------------------------------------------------------------------- */

export const createCategorySchema = z.object({
  name: nameSchema,
  color: colorSchema.optional(),
  icon: categoryIconSchema.optional(),
});

export const updateCategorySchema = z.object({
  id: idSchema,
  name: nameSchema.optional(),
  color: colorSchema.optional(),
  icon: categoryIconSchema.optional(),
  position: positionSchema.optional(),
});

/* -------------------------------------------------------------------------- */
/* Settings                                                                   */
/* -------------------------------------------------------------------------- */

export const updateSettingsSchema = z.object({
  theme: themeSchema.optional(),
  timezone: z
    .string()
    .trim()
    .min(1)
    .refine(isValidTimeZone, "Unknown timezone.")
    .optional(),
  weekStartsOn: z.number().int().min(0).max(6).optional(),
  fontScale: fontScaleSchema.optional(),
});

/** Nickname and avatar. Locked-avatar rules are enforced in the service/action. */
export const updateProfileSchema = z
  .object({
    nickname: nicknameSchema.optional(),
    avatarId: avatarIdSchema.optional(),
  })
  .refine(
    (value) => value.nickname !== undefined || value.avatarId !== undefined,
    "Nothing to update.",
  );

/* -------------------------------------------------------------------------- */
/* Habits                                                                     */
/* -------------------------------------------------------------------------- */

export const habitTitleSchema = z
  .string()
  .trim()
  .min(1, "A habit needs a title.")
  .max(TITLE_MAX_LENGTH, `Titles are limited to ${TITLE_MAX_LENGTH} characters.`);

/** Weekday numbers the habit is due on; normalised so storage is stable. */
export const habitDaysSchema = z
  .array(z.number().int().min(0).max(6), { invalid_type_error: "Pick at least one day." })
  .min(1, "A habit needs at least one day.")
  .max(7)
  .transform((days) => [...new Set(days)].sort((a, b) => a - b));

export const createHabitSchema = z.object({
  title: habitTitleSchema,
  notes: notesSchema.optional(),
  categoryId: optionalIdSchema.optional(),
  days: habitDaysSchema.optional(),
});

export type CreateHabitValues = z.output<typeof createHabitSchema>;

export const updateHabitSchema = z
  .object({
    id: idSchema,
    title: habitTitleSchema.optional(),
    notes: notesSchema.optional(),
    categoryId: optionalIdSchema.optional(),
    days: habitDaysSchema.optional(),
    paused: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 1, "Nothing to update.");

export type UpdateHabitValues = z.output<typeof updateHabitSchema>;

export const habitIdSchema = z.object({ id: idSchema });

/**
 * Ticking a habit's day off (or off again) from the month grid.
 *
 * Only a day that has already happened, and that the habit is actually due on,
 * is accepted — the service checks the same rule with the account's timezone.
 */
export const setHabitDaySchema = z.object({
  habitId: idSchema,
  date: dateOnlySchema,
  done: z.boolean(),
});

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

export type FieldErrors = Record<string, string[]>;

/** Flatten a Zod error into the `{ field: [messages] }` shape used by the UI. */
export function flattenZodError(error: z.ZodError): FieldErrors {
  const fields: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    fields[key] = [...(fields[key] ?? []), issue.message];
  }
  return fields;
}

export function firstErrorMessage(error: z.ZodError, fallback = "Invalid input."): string {
  return error.issues[0]?.message ?? fallback;
}

export const statusValues = taskStatusSchema.options as TaskStatus[];
