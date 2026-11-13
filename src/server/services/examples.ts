import "server-only";

import { addDays } from "@/lib/dates";
import { dateOnlyToDate, todayDateOnly } from "@/lib/dates";
import { scopedPrisma } from "@/server/db";
import { recordTaskEvent } from "@/server/services/events";
import { ServiceError } from "@/server/errors";
import { getSettings } from "@/server/services/settings";

/**
 * The three categories every example workspace gets.
 *
 * Hoisted from the loader so "remove example data" can name them without a
 * second copy of the strings (see `removeExampleData`).
 */
export const EXAMPLE_CATEGORIES = [
  { name: "Work", color: "#3b82f6", icon: "Briefcase" },
  { name: "Personal", color: "#22c55e", icon: "Home" },
  { name: "Learning", color: "#8b5cf6", icon: "GraduationCap" },
] as const;

export type ExampleCategoryName = (typeof EXAMPLE_CATEGORIES)[number]["name"];

type ExampleTask = {
  title: string;
  notes?: string;
  category: ExampleCategoryName | null;
  /**
   * Planned day and deadline as offsets from "today", so the sample still reads
   * as current work whenever it is loaded. `null` means "not scheduled".
   */
  scheduledOffset: number | null;
  dueOffset: number | null;
  subtasks: readonly string[];
  completed?: true;
};

const EXAMPLE_TASKS: readonly ExampleTask[] = [
  {
    title: "Draft the Q4 roadmap",
    notes: "Three themes: retention, onboarding, and reporting.",
    category: "Work",
    scheduledOffset: 0,
    dueOffset: 2,
    subtasks: ["Collect customer feedback", "Outline the themes", "Review with the team"],
  },
  {
    title: "Review pull requests",
    category: "Work",
    scheduledOffset: 0,
    dueOffset: null,
    subtasks: ["Storage layer", "Dashboard polish"],
  },
  {
    title: "Book the dentist",
    category: "Personal",
    scheduledOffset: 0,
    dueOffset: 1,
    subtasks: [],
  },
  {
    // Late on purpose, so Today shows its Overdue group.
    title: "Send the Q3 invoice",
    notes: "Numbers are in the shared sheet; attach last quarter's timesheet.",
    category: "Work",
    scheduledOffset: -2,
    dueOffset: null,
    subtasks: [],
  },
  {
    title: "Weekly review",
    notes: "Clear the list, plan next week, pick three priorities.",
    category: null,
    scheduledOffset: 1,
    dueOffset: null,
    subtasks: [],
  },
  {
    title: "Finish the TypeScript course",
    category: "Learning",
    scheduledOffset: 3,
    dueOffset: 10,
    subtasks: ["Generics chapter", "Practice project"],
  },
  {
    title: "Replace the kitchen filter",
    category: "Personal",
    scheduledOffset: null,
    dueOffset: null,
    subtasks: [],
  },
  {
    title: "Publish the changelog",
    category: "Work",
    scheduledOffset: null,
    dueOffset: -1,
    subtasks: [],
    completed: true,
  },
];

/** Every task title the loader creates — what "remove example data" matches on. */
export const EXAMPLE_TASK_TITLES: readonly string[] = EXAMPLE_TASKS.map(
  (task) => task.title,
);

/**
 * Sample habits: six weeks, oldest first, one character per day — "x" is a day
 * that was ticked off, "." one that was skipped.
 *
 * Hand-written rather than generated, so the sample reads like a real, imperfect
 * month: one habit kept up, one that improved, and one that faded out — which
 * gives the grid, the streak and the trend chart something honest to show.
 *
 * The last character of every pattern is today, and it is "." everywhere on
 * purpose: today's instances are generated as open tasks, so Today has its work
 * waiting and the grid agrees with it.
 */
const EXAMPLE_HABITS = [
  {
    title: "Read for 20 minutes",
    category: "Learning",
    notes: "Twenty pages, or twenty minutes — whichever comes first.",
    weeks: ["xxxxx.x", "xxxxxxx", "xxxxx.x", "xxxxxxx", "xxxxx.x", "xxxxxx."],
  },
  {
    title: "Morning walk",
    category: "Personal",
    notes: "Round the park before the first coffee.",
    weeks: ["x..xx.x", "xx.x.xx", "xxxxx.x", "xxxxxxx", "xxxxxxx", "xxxxxx."],
  },
  {
    title: "Practice guitar",
    category: null,
    notes: "Fifteen minutes of scales, then one song.",
    weeks: ["xx.xxx.", "x.xx.xx", "xx.x.x.", "x..x...", "..x....", "......."],
  },
] as const;

/** Every habit title the loader creates — what "remove example data" matches on. */
export const EXAMPLE_HABIT_TITLES: readonly string[] = EXAMPLE_HABITS.map(
  (habit) => habit.title,
);

/**
 * A small, deliberately explicit set of example tasks.
 *
 * The set touches every feature the app ships: categories, planned and due
 * dates, notes, one level of subtasks, one unscheduled task, one completed task
 * and one task that is late on purpose so Today shows its Overdue group.
 *
 * This never runs automatically: the first-run screen offers it as a button, and
 * only when the database is still completely empty, so a real workspace can
 * never be polluted with demo data.
 */
export async function loadExampleTasks(
  userId: string,
): Promise<{ tasks: number; categories: number; habits: number }> {
  const prisma = scopedPrisma(userId);
  const [taskCount, categoryCount, habitCount] = await Promise.all([
    prisma.task.count(),
    prisma.category.count(),
    prisma.habit.count(),
  ]);

  if (taskCount > 0 || categoryCount > 0 || habitCount > 0) {
    throw new ServiceError(
      "Example data can only be loaded into an empty workspace. Delete your existing data first.",
    );
  }

  const settings = await getSettings(userId);
  const today = todayDateOnly(settings.timezone);
  const day = (offset: number) => dateOnlyToDate(addDays(today, offset));

  const [work, personal, learning] = await Promise.all(
    EXAMPLE_CATEGORIES.map((category, position) =>
      prisma.category.create({ data: { userId, ...category, position } }),
    ),
  );

  const categoryByKey = { Work: work, Personal: personal, Learning: learning } as const;

  let position = 0;
  let created = 0;

  for (const item of EXAMPLE_TASKS) {
    const completed = item.completed === true;
    const categoryId = item.category ? categoryByKey[item.category].id : null;
    const task = await prisma.task.create({
      data: {
        userId,
        title: item.title,
        notes: item.notes ?? null,
        categoryId,
        scheduledDate: item.scheduledOffset === null ? null : day(item.scheduledOffset),
        dueDate: item.dueOffset === null ? null : day(item.dueOffset),
        position,
        status: completed ? "DONE" : "TODO",
        completedAt: completed ? day(-1) : null,
      },
    });
    position += 1;
    created += 1;

    if (completed) {
      await recordTaskEvent(prisma, {
        taskId: task.id,
        action: "completed",
        example: true,
      });
    }

    let subtaskPosition = 0;
    for (const subtaskTitle of item.subtasks) {
      await prisma.task.create({
        data: {
          userId,
          title: subtaskTitle,
          parentId: task.id,
          categoryId,
          position: subtaskPosition,
        },
      });
      subtaskPosition += 1;
      created += 1;
    }
  }

  // --- sample habits -------------------------------------------------------
  //
  // The plan (and its six weeks of history) is the module-level EXAMPLE_HABITS
  // above, shared with `removeExampleData` so the two can never drift apart.
  const habitPlan = EXAMPLE_HABITS;

  // The block ends today, so day 0 of the plan is six weeks ago.
  const habitStart = day(-41);
  let habitPosition = 0;

  for (const item of habitPlan) {
    const habit = await prisma.habit.create({
      data: {
        userId,
        title: item.title,
        notes: item.notes,
        categoryId: item.category ? categoryByKey[item.category].id : null,
        days: "0,1,2,3,4,5,6",
        position: habitPosition,
        paused: false,
        startDate: habitStart,
      },
    });
    habitPosition += 1;

    // Completion lives in the event log, not in task rows: a day that was missed
    // has no record at all, exactly as it would in real use.
    const marks = item.weeks.join("");
    for (let index = 0; index < marks.length; index += 1) {
      const offset = index - (marks.length - 1);
      if (marks[index] !== "x" || offset === 0) continue;
      await recordTaskEvent(prisma, {
        taskId: null,
        action: "completed",
        habitDay: { habitId: habit.id, habitDate: addDays(today, offset) },
        example: true,
      });
    }
  }

  return { tasks: created, categories: 3, habits: habitPlan.length };
}

/**
 * Delete the sample workspace again: the demo tasks, their subtasks, the demo
 * habits (with their generated instances) and the history the loader wrote.
 *
 * Rows are recognised by **title**, using the same module-level lists the loader
 * builds from — the only identifier a sample row carries. A sample task the
 * person renamed is no longer recognisable and is kept, which is the safe
 * failure: this must never delete real work. The three demo categories are
 * removed only when nothing else (no task, no habit) still points at them.
 *
 * Everything runs in one transaction, so a failure leaves the workspace intact.
 */
export async function removeExampleData(
  userId: string,
): Promise<{ tasks: number; habits: number; categories: number }> {
  const prisma = scopedPrisma(userId);

  return prisma.$transaction(async (tx) => {
    // History first: the loader marks its events with `example: true`, so the
    // sample's six weeks stop counting towards the statistics even though the
    // rows it describes are about to disappear.
    await tx.taskEvent.deleteMany({ where: { metadata: { contains: '"example":true' } } });

    // Top-level sample tasks; subtasks follow through the cascade.
    const tasks = await tx.task.deleteMany({
      where: { parentId: null, title: { in: [...EXAMPLE_TASK_TITLES] } },
    });

    // Sample habits; their generated instances follow through the cascade.
    const habits = await tx.habit.deleteMany({
      where: { title: { in: [...EXAMPLE_HABIT_TITLES] } },
    });

    // Only the demo categories that are now unused — a category the person kept
    // (and put their own tasks in) stays.
    const categories = await tx.category.deleteMany({
      where: {
        name: { in: EXAMPLE_CATEGORIES.map((category) => category.name) },
        tasks: { none: {} },
        habits: { none: {} },
      },
    });

    return { tasks: tasks.count, habits: habits.count, categories: categories.count };
  });
}
