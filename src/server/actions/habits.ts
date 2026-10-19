"use server";

import {
  createHabitSchema,
  habitIdSchema,
  setHabitDaySchema,
  updateHabitSchema,
} from "@/lib/validation";
import type { ActionResult, HabitDTO } from "@/types/kairos";
import { runAction } from "@/server/actions/helpers";
import { getRequestContext } from "@/server/context";
import {
  createHabit,
  deleteHabit,
  setHabitDay,
  updateHabit,
} from "@/server/services/habits";

export async function createHabitAction(input: unknown): Promise<ActionResult<HabitDTO>> {
  return runAction(async () => {
    const values = createHabitSchema.parse(input);
    return createHabit(await getRequestContext(), values);
  });
}

/**
 * Edit a habit: its title, notes, category, the days it is due on, or the paused
 * flag. Today's generated task follows the change.
 */
export async function updateHabitAction(input: unknown): Promise<ActionResult<HabitDTO>> {
  return runAction(async () => {
    const values = updateHabitSchema.parse(input);
    return updateHabit(await getRequestContext(), values);
  });
}

/** Delete a habit together with the tasks it generated. */
export async function deleteHabitAction(input: unknown): Promise<ActionResult<HabitDTO>> {
  return runAction(async () => {
    const { id } = habitIdSchema.parse(input);
    return deleteHabit(await getRequestContext(), id);
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
    const values = setHabitDaySchema.parse(input);
    await setHabitDay(await getRequestContext(), values);
    return undefined;
  });
}
