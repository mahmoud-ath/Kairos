"use server";

import {
  createHabitSchema,
  habitIdSchema,
  setHabitDaySchema,
  updateHabitSchema,
} from "@/lib/validation";
import { todayDateOnly } from "@/lib/dates";
import type { ActionResult, HabitDTO } from "@/types/kairos";
import { requireUserId } from "@/server/auth";
import { runAction } from "@/server/actions/helpers";
import {
  createHabit,
  deleteHabit,
  setHabitDay,
  updateHabit,
} from "@/server/services/habits";
import { getSettingsRecord } from "@/server/services/settings";

/** Today, in the account's timezone — the day a habit change applies to. */
async function currentDay(userId: string): Promise<string> {
  const settings = await getSettingsRecord(userId);
  return todayDateOnly(settings.timezone);
}

export async function createHabitAction(input: unknown): Promise<ActionResult<HabitDTO>> {
  return runAction(async () => {
    const userId = await requireUserId();
    const values = createHabitSchema.parse(input);
    return createHabit(userId, values, await currentDay(userId));
  });
}

/**
 * Edit a habit: its title, notes, category, the days it is due on, or the paused
 * flag. Today's generated task follows the change.
 */
export async function updateHabitAction(input: unknown): Promise<ActionResult<HabitDTO>> {
  return runAction(async () => {
    const userId = await requireUserId();
    const values = updateHabitSchema.parse(input);
    return updateHabit(userId, values, await currentDay(userId));
  });
}

/** Delete a habit together with the tasks it generated. */
export async function deleteHabitAction(input: unknown): Promise<ActionResult<HabitDTO>> {
  return runAction(async () => {
    const userId = await requireUserId();
    const { id } = habitIdSchema.parse(input);
    return deleteHabit(userId, id);
  });
}

/**
 * Tick one day of a habit off — or off again — from the month grid.
 *
 * The same rule the grid renders is applied here: only a due day that has
 * already happened is accepted, so a tampered request cannot invent history.
 */
export async function setHabitDayAction(input: unknown): Promise<ActionResult<undefined>> {
  return runAction(async () => {
    const userId = await requireUserId();
    const values = setHabitDaySchema.parse(input);
    await setHabitDay(userId, values, await currentDay(userId));
    return undefined;
  });
}
