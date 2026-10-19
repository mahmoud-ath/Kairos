import "server-only";

import {
  addDays,
  addMonths,
  compareDateOnly,
  dateOnlyToDate,
  dateRange,
  dateToDateOnly,
  endOfMonth,
  formatMonthLabel,
  parseMonthParam,
  startOfMonth,
} from "@/lib/dates";
import {
  EVERY_DAY,
  HABIT_RATE_WINDOW_DAYS,
  HABIT_STREAK_LOOKBACK_DAYS,
  buildHabitCompletionLog,
  formatHabitDays,
  habitCompletionRate,
  habitHistory,
  habitStreak,
  habitTrend,
  isHabitDayEditable,
  isHabitDueOnDate,
  isValidHabitTrendWindow,
  parseHabitDays,
  type HabitDay,
  type HabitTrendPoint,
  type HabitTrendWindow,
} from "@/lib/habits";
import type { CreateHabitValues, UpdateHabitValues } from "@/lib/validation";
import type { HabitDTO, HabitMonth, HabitProgress } from "@/types/kairos";
import { scopedPrisma, type Prisma, type ScopedTx } from "@/server/db";
import { ServiceError } from "@/server/errors";
import type { RequestContext } from "@/server/context";
import { setTaskStatus } from "@/server/services/tasks";

/**
 * Habits.
 *
 * A habit is the *recipe*; the generated `Task` is the *instance*. Nothing here
 * stores progress: `done` is derived from the completion history of the
 * instances, so the append-only `TaskEvent` log stays the single source of truth
 * for what happened — exactly like statistics.
 *
 * Every function takes the owner's id and works through a client that cannot see
 * anybody else's rows (see `scopedPrisma`).
 */

type HabitRow = {
  id: string;
  title: string;
  notes: string | null;
  categoryId: string | null;
  days: string;
  position: number;
  paused: boolean;
  startDate: Date;
};

function serializeHabit(habit: HabitRow): HabitDTO {
  return {
    id: habit.id,
    title: habit.title,
    notes: habit.notes,
    categoryId: habit.categoryId,
    days: parseHabitDays(habit.days),
    position: habit.position,
    paused: habit.paused,
    startDate: dateToDateOnly(habit.startDate),
  };
}

/** Habits in display order. */
export async function listHabits(ctx: RequestContext): Promise<HabitDTO[]> {
  const { userId } = ctx;
  const prisma = scopedPrisma(userId);
  const rows = await prisma.habit.findMany({
    orderBy: [{ position: "asc" }, { createdAt: "asc" }, { id: "asc" }],
  });
  return rows.map(serializeHabit);
}

export async function getHabit(ctx: RequestContext, id: string): Promise<HabitDTO | null> {
  const { userId } = ctx;
  const prisma = scopedPrisma(userId);
  const row = await prisma.habit.findUnique({ where: { id } });
  return row ? serializeHabit(row) : null;
}

async function assertCategoryExists(db: ScopedTx, categoryId: string): Promise<void> {
  const category = await db.category.findUnique({
    where: { id: categoryId },
    select: { id: true },
  });
  if (!category) throw new ServiceError("That category no longer exists.");
}

/* -------------------------------------------------------------------------- */
/* Writes                                                                     */
/* -------------------------------------------------------------------------- */

export async function createHabit(
  ctx: RequestContext,
  values: CreateHabitValues,
): Promise<HabitDTO> {
  const { userId, today } = ctx;
  const prisma = scopedPrisma(userId);
  if (values.categoryId) await assertCategoryExists(prisma, values.categoryId);

  const last = await prisma.habit.findFirst({
    orderBy: { position: "desc" },
    select: { position: true },
  });

  const created = await prisma.habit.create({
    data: {
      userId,
      title: values.title,
      notes: values.notes ?? null,
      categoryId: values.categoryId ?? null,
      days: formatHabitDays(values.days ?? EVERY_DAY),
      position: last ? last.position + 1 : 0,
      // A habit never counts days before it was created.
      startDate: dateOnlyToDate(today),
    },
  });

  return serializeHabit(created);
}

/**
 * Edit a habit's configuration.
 *
 * The context's `today` is used so the change is reflected in the day that is
 * already open: renaming a habit, or moving it to another category, updates
 * today's generated task in the same transaction. Past days are history and stay
 * as they were.
 */
export async function updateHabit(
  ctx: RequestContext,
  values: UpdateHabitValues,
): Promise<HabitDTO> {
  const { userId, today } = ctx;
  const prisma = scopedPrisma(userId);

  return prisma.$transaction(async (tx) => {
    const existing = await tx.habit.findUnique({ where: { id: values.id } });
    if (!existing) throw new ServiceError("Habit not found.");

    if (values.categoryId) await assertCategoryExists(tx, values.categoryId);

    const data: Prisma.HabitUpdateInput = {};
    const taskData: Prisma.TaskUncheckedUpdateManyInput = {};

    if (values.title !== undefined) {
      data.title = values.title;
      taskData.title = values.title;
    }
    if (values.notes !== undefined) {
      data.notes = values.notes;
      taskData.notes = values.notes;
    }
    if (values.categoryId !== undefined) {
      data.category = values.categoryId
        ? { connect: { id: values.categoryId } }
        : { disconnect: true };
      taskData.categoryId = values.categoryId;
    }
    if (values.days !== undefined) data.days = formatHabitDays(values.days);
    if (values.paused !== undefined) data.paused = values.paused;

    const updated = await tx.habit.update({ where: { id: values.id }, data });

    if (Object.keys(taskData).length > 0) {
      await tx.task.updateMany({
        where: { habitId: values.id, habitDate: dateOnlyToDate(today) },
        data: taskData,
      });
    }

    return serializeHabit(updated);
  });
}

/**
 * Delete a habit and its generated tasks.
 *
 * History rows in `TaskEvent` survive (their `taskId` becomes null) but are
 * meaningless once the habit is gone, so nothing is kept for it.
 */
export async function deleteHabit(ctx: RequestContext, id: string): Promise<HabitDTO> {
  const { userId } = ctx;
  const prisma = scopedPrisma(userId);
  const habit = await prisma.habit.findUnique({ where: { id } });
  if (!habit) throw new ServiceError("Habit not found.");

  await prisma.habit.delete({ where: { id } });
  return serializeHabit(habit);
}

/* -------------------------------------------------------------------------- */
/* Generation                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Make sure today's habit instances exist — and that no other day's linger.
 *
 * Called on every workspace render, so it is written to be idempotent and, on
 * the common path, read-only: the work is decided from two cheap reads and the
 * write transaction is only opened when something actually changed.
 *
 * A day that is over and was never completed is simply dropped, because a habit
 * is not a backlog — a missed day is missing from the history, not waiting to be
 * done late. Completed instances are kept: they are the record.
 */
export async function ensureHabitInstances(ctx: RequestContext): Promise<void> {
  const { userId, today } = ctx;
  const prisma = scopedPrisma(userId);
  const todayDate = dateOnlyToDate(today);

  const habits = (
    await prisma.habit.findMany({
      where: { paused: false },
      orderBy: [{ position: "asc" }, { id: "asc" }],
    })
  ).map(serializeHabit);
  const due = habits.filter((habit) => isHabitDueOnDate(habit, today));
  const dueIds = new Set(due.map((habit) => habit.id));

  const [instances, missedCount] = await Promise.all([
    // Today's instances, which decide both what is missing and what is stale.
    prisma.task.findMany({
      where: { habitId: { not: null }, habitDate: todayDate },
      select: { id: true, habitId: true, status: true },
    }),
    // Days that are over and were never completed.
    prisma.task.count({
      where: { habitId: { not: null }, habitDate: { lt: todayDate }, status: "TODO" },
    }),
  ]);

  const existingIds = new Set(instances.map((instance) => instance.habitId));
  const create = due.filter((habit) => !existingIds.has(habit.id));

  // Still open today, but its habit is no longer due today (paused, or the
  // cadence changed). A completed row is history and is left alone.
  const removeToday = instances.filter(
    (instance) =>
      instance.status === "TODO" && (!instance.habitId || !dueIds.has(instance.habitId)),
  );

  if (create.length === 0 && removeToday.length === 0 && missedCount === 0) return;

  await prisma.$transaction(async (tx) => {
    if (missedCount > 0) {
      await tx.task.deleteMany({
        where: { habitId: { not: null }, habitDate: { lt: todayDate }, status: "TODO" },
      });
    }
    if (removeToday.length > 0) {
      await tx.task.deleteMany({ where: { id: { in: removeToday.map((row) => row.id) } } });
    }
    if (create.length > 0) {
      await tx.task.createMany({
        data: create.map((habit) => ({
          userId,
          title: habit.title,
          notes: habit.notes,
          categoryId: habit.categoryId,
          habitId: habit.id,
          habitDate: todayDate,
          // The instance is planned for the day it belongs to, which is what
          // makes it appear in Today and nowhere else.
          scheduledDate: todayDate,
          position: habit.position,
          status: "TODO",
        })),
        skipDuplicates: true,
      });
    }
  });
}

/* -------------------------------------------------------------------------- */
/* Progress                                                                   */
/* -------------------------------------------------------------------------- */

/** How far back the month grid can be navigated. */
export const HABIT_MONTH_HISTORY_MONTHS = 12;

/**
 * Everything the habits page reads: per-habit progress, the month grid and the
 * 30-day trend.
 *
 * All three are derived from the same completion history, so they share one
 * read of the `TaskEvent` log — and because the history is read rather than the
 * task table, clearing completed tasks never rewrites a habit's past.
 */
export type HabitBoard = {
  progress: Record<string, HabitProgress>;
  /** Day-by-day completion across every tracked habit, oldest first. */
  trend: HabitTrendPoint[];
  /** The window `trend` covers, in days. */
  trendWindow: HabitTrendWindow;
  /** Per habit, the displayed month's days. Keyed by habit id. */
  grid: Record<string, HabitDay[]>;
  month: HabitMonth;
};

/**
 * Read the board for one month (defaults to the account's current month) and one
 * trend window.
 *
 * Both come from the query string, so they are clamped rather than trusted: no
 * future month, no further back than a year, and no window outside
 * `HABIT_TREND_WINDOWS`.
 */
export async function getHabitBoard(
  ctx: RequestContext,
  habits: readonly HabitDTO[],
  options: { month?: string | null; trendWindow?: number } = {},
): Promise<HabitBoard> {
  const { userId, today } = ctx;
  const prisma = scopedPrisma(userId);

  const trendWindow: HabitTrendWindow =
    options.trendWindow !== undefined && isValidHabitTrendWindow(options.trendWindow)
      ? options.trendWindow
      : HABIT_RATE_WINDOW_DAYS;

  const currentMonth = startOfMonth(today);
  const earliestMonth = addMonths(currentMonth, -(HABIT_MONTH_HISTORY_MONTHS - 1));
  const requested = parseMonthParam(options.month) ?? currentMonth;
  const first = compareDateOnly(requested, earliestMonth) < 0
    ? earliestMonth
    : compareDateOnly(requested, currentMonth) > 0
      ? currentMonth
      : requested;
  const last = endOfMonth(first);
  const days = dateRange(first, last);

  // One read covers every window: the streak walk, the trend, and the displayed
  // month when it reaches further back than either. `reopened` is read alongside
  // `completed` because taking a day back is recorded as another event rather
  // than by rewriting history — oldest first, so the log can be folded in order.
  const horizons = [
    first,
    addDays(today, -HABIT_STREAK_LOOKBACK_DAYS),
    addDays(today, -trendWindow),
  ];
  const horizon = horizons.reduce((earliest, value) =>
    compareDateOnly(value, earliest) < 0 ? value : earliest,
  );
  const events = await prisma.taskEvent.findMany({
    where: {
      action: { in: ["completed", "reopened"] },
      timestamp: { gte: dateOnlyToDate(horizon) },
    },
    orderBy: [{ timestamp: "asc" }, { id: "asc" }],
    select: { action: true, metadata: true },
  });
  const completions = buildHabitCompletionLog(events);

  const progress: Record<string, HabitProgress> = {};
  for (const habit of habits) {
    const dueToday = isHabitDueOnDate(habit, today);
    progress[habit.id] = {
      habitId: habit.id,
      dueToday,
      doneToday: dueToday && Boolean(completions.get(habit.id)?.has(today)),
      streak: habitStreak(habit, completions, today),
      rate: habitCompletionRate(habit, completions, today),
    };
  }

  // Only tracked habits appear in the grid and the trend: a paused habit keeps
  // its history but is not something the user is expected to do any more.
  const tracked = habits.filter((habit) => !habit.paused);
  const grid: Record<string, HabitDay[]> = {};
  for (const habit of tracked) {
    // `last` + the month length is exactly the month, oldest first.
    grid[habit.id] = habitHistory(habit, completions, last, days.length);
  }

  return {
    progress,
    trend: habitTrend(tracked, completions, today, trendWindow),
    trendWindow,
    grid,
    month: {
      first,
      label: formatMonthLabel(first),
      days,
      canGoPrevious: compareDateOnly(first, earliestMonth) > 0,
      canGoNext: compareDateOnly(first, currentMonth) < 0,
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Correcting a day by hand                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Tick one day of a habit off — or off again — from the month grid.
 *
 * This is the one place a habit's day is written from anywhere other than Today,
 * and it exists because a day can be forgotten. It still goes through the same
 * machinery: the day gets an ordinary generated task (created on the spot if the
 * missed day had already been dropped), and completing *that* is what the habit's
 * history records.
 *
 * Un-ticking an old day sets its task back to open, which the next
 * `ensureHabitInstances` sweeps away — so a corrected day disappears from the
 * history completely rather than lingering as a half-state.
 */
export async function setHabitDay(
  ctx: RequestContext,
  input: { habitId: string; date: string; done: boolean },
): Promise<void> {
  const { userId, today } = ctx;
  const prisma = scopedPrisma(userId);
  const habit = await prisma.habit.findUnique({ where: { id: input.habitId } });
  if (!habit) throw new ServiceError("Habit not found.");

  const serialized = serializeHabit(habit);
  if (compareDateOnly(input.date, today) > 0) {
    throw new ServiceError("That day has not happened yet.");
  }
  if (!isHabitDayEditable(serialized, input.date, today)) {
    throw new ServiceError("This habit is not due on that day.");
  }

  const habitDate = dateOnlyToDate(input.date);
  const existing = await prisma.task.findFirst({
    where: { habitId: habit.id, habitDate },
    select: { id: true, status: true },
  });

  if (input.done) {
    if (existing?.status === "DONE") return;

    if (existing) {
      await setTaskStatus(userId, existing.id, "DONE");
      return;
    }

    // The day was never checked off, so its instance was swept away as a missed
    // day — recreate it, then complete it through the normal path.
    const created = await prisma.task.create({
      data: {
        userId,
        title: habit.title,
        notes: habit.notes,
        categoryId: habit.categoryId,
        habitId: habit.id,
        habitDate,
        scheduledDate: habitDate,
        position: habit.position,
        status: "TODO",
      },
      select: { id: true },
    });
    await setTaskStatus(userId, created.id, "DONE");
    return;
  }

  if (existing?.status === "DONE") {
    await setTaskStatus(userId, existing.id, "TODO");
  }
}
