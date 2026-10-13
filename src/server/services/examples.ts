import "server-only";

import { addDays } from "@/lib/dates";
import { dateOnlyToDate, todayDateOnly } from "@/lib/dates";
import { scopedPrisma } from "@/server/db";
import { recordTaskEvent } from "@/server/services/events";
import { ServiceError } from "@/server/services/tasks";
import { getSettings } from "@/server/services/settings";

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

  const [work, personal, learning] = await Promise.all([
    prisma.category.create({
      data: { userId, name: "Work", color: "#3b82f6", icon: "Briefcase", position: 0 },
    }),
    prisma.category.create({
      data: { userId, name: "Personal", color: "#22c55e", icon: "Home", position: 1 },
    }),
    prisma.category.create({
      data: { userId, name: "Learning", color: "#8b5cf6", icon: "GraduationCap", position: 2 },
    }),
  ]);

  const categoryByKey = { Work: work, Personal: personal, Learning: learning } as const;

  const plan = [
    {
      title: "Draft the Q4 roadmap",
      notes: "Three themes: retention, onboarding, and reporting.",
      categoryId: work.id,
      scheduledDate: day(0),
      dueDate: day(2),
      subtasks: ["Collect customer feedback", "Outline the themes", "Review with the team"],
    },
    {
      title: "Review pull requests",
      categoryId: work.id,
      scheduledDate: day(0),
      dueDate: null,
      subtasks: ["Storage layer", "Dashboard polish"],
    },
    {
      title: "Book the dentist",
      categoryId: personal.id,
      scheduledDate: day(0),
      dueDate: day(1),
      subtasks: [],
    },
    {
      // Late on purpose, so Today shows its Overdue group.
      title: "Send the Q3 invoice",
      notes: "Numbers are in the shared sheet; attach last quarter's timesheet.",
      categoryId: work.id,
      scheduledDate: day(-2),
      dueDate: null,
      subtasks: [],
    },
    {
      title: "Weekly review",
      notes: "Clear the list, plan next week, pick three priorities.",
      categoryId: null,
      scheduledDate: day(1),
      dueDate: null,
      subtasks: [],
    },
    {
      title: "Finish the TypeScript course",
      categoryId: learning.id,
      scheduledDate: day(3),
      dueDate: day(10),
      subtasks: ["Generics chapter", "Practice project"],
    },
    {
      title: "Replace the kitchen filter",
      categoryId: personal.id,
      scheduledDate: null,
      dueDate: null,
      subtasks: [],
    },
    {
      title: "Publish the changelog",
      categoryId: work.id,
      scheduledDate: null,
      dueDate: day(-1),
      subtasks: [],
      completed: true,
    },
  ] as const;

  let position = 0;
  let created = 0;

  for (const item of plan) {
    const completed = "completed" in item && item.completed === true;
    const task = await prisma.task.create({
      data: {
        userId,
        title: item.title,
        notes: "notes" in item ? (item.notes as string) : null,
        categoryId: item.categoryId,
        scheduledDate: item.scheduledDate ?? null,
        dueDate: item.dueDate ?? null,
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
        metadata: { example: true },
      });
    }

    let subtaskPosition = 0;
    for (const subtaskTitle of item.subtasks) {
      await prisma.task.create({
        data: {
          userId,
          title: subtaskTitle,
          parentId: task.id,
          categoryId: item.categoryId,
          position: subtaskPosition,
        },
      });
      subtaskPosition += 1;
      created += 1;
    }
  }

  // --- sample habits -------------------------------------------------------
  //
  // Six weeks, oldest first, one character per day: "x" is a day that was ticked
  // off, "." one that was skipped. Hand-written rather than generated, so the
  // sample reads like a real, imperfect month: one habit kept up, one that
  // improved, and one that faded out — which gives the grid, the streak and the
  // trend chart something honest to show.
  //
  // The last character of every pattern is today, and it is "." everywhere on
  // purpose: today's instances are generated as open tasks, so Today has its
  // work waiting and the grid agrees with it.
  const habitPlan = [
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
        metadata: { habitId: habit.id, habitDate: addDays(today, offset), example: true },
      });
    }
  }

  return { tasks: created, categories: 3, habits: habitPlan.length };
}
