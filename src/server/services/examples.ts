import "server-only";

import { addDays } from "@/lib/dates";
import { dateOnlyToDate, todayDateOnly } from "@/lib/dates";
import { prisma } from "@/server/db";
import { recordTaskEvent } from "@/server/services/events";
import { ServiceError } from "@/server/services/tasks";
import { getSettings } from "@/server/services/settings";

/**
 * A small, deliberately explicit set of example tasks.
 *
 * This never runs automatically: the first-run screen offers it as a button, and
 * only when the database is still completely empty, so a real workspace can
 * never be polluted with demo data.
 */
export async function loadExampleTasks(): Promise<{ tasks: number; categories: number }> {
  const [taskCount, categoryCount, labelCount] = await Promise.all([
    prisma.task.count(),
    prisma.category.count(),
    prisma.label.count(),
  ]);

  if (taskCount > 0 || categoryCount > 0 || labelCount > 0) {
    throw new ServiceError(
      "Example data can only be loaded into an empty workspace. Delete your existing data first.",
    );
  }

  const settings = await getSettings();
  const today = todayDateOnly(settings.timezone);
  const day = (offset: number) => dateOnlyToDate(addDays(today, offset));

  const [work, personal, learning] = await Promise.all([
    prisma.category.create({ data: { name: "Work", color: "#3b82f6", position: 0 } }),
    prisma.category.create({ data: { name: "Personal", color: "#22c55e", position: 1 } }),
    prisma.category.create({ data: { name: "Learning", color: "#8b5cf6", position: 2 } }),
  ]);

  const [deepWork, quickWin] = await Promise.all([
    prisma.label.create({ data: { name: "Deep work", color: "#f97316" } }),
    prisma.label.create({ data: { name: "Quick win", color: "#14b8a6" } }),
  ]);

  const plan = [
    {
      title: "Draft the Q3 roadmap",
      notes: "Three themes: retention, onboarding, and reporting.",
      priority: "HIGH",
      categoryId: work.id,
      scheduledDate: day(0),
      dueDate: day(2),
      labels: [deepWork.id],
      subtasks: ["Collect customer feedback", "Outline the themes", "Review with the team"],
    },
    {
      title: "Review pull requests",
      priority: "MEDIUM",
      categoryId: work.id,
      scheduledDate: day(0),
      dueDate: null,
      labels: [quickWin.id],
      subtasks: ["Storage layer", "Dashboard polish"],
    },
    {
      title: "Book the dentist",
      priority: "LOW",
      categoryId: personal.id,
      scheduledDate: day(0),
      dueDate: day(1),
      labels: [quickWin.id],
      subtasks: [],
    },
    {
      title: "Weekly review",
      notes: "Clear the inbox, plan next week, pick three priorities.",
      priority: "MEDIUM",
      categoryId: null,
      scheduledDate: day(1),
      dueDate: null,
      labels: [],
      subtasks: [],
    },
    {
      title: "Finish the TypeScript course",
      priority: "LOW",
      categoryId: learning.id,
      scheduledDate: day(3),
      dueDate: day(10),
      labels: [deepWork.id],
      subtasks: ["Generics chapter", "Practice project"],
    },
    {
      title: "Replace the kitchen filter",
      priority: "NONE",
      categoryId: personal.id,
      scheduledDate: null,
      dueDate: null,
      labels: [],
      subtasks: [],
    },
    {
      title: "Publish the changelog",
      priority: "MEDIUM",
      categoryId: work.id,
      scheduledDate: null,
      dueDate: day(-1),
      labels: [],
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
        title: item.title,
        notes: "notes" in item ? (item.notes as string) : null,
        priority: item.priority,
        categoryId: item.categoryId,
        scheduledDate: item.scheduledDate ?? null,
        dueDate: item.dueDate ?? null,
        position,
        status: completed ? "DONE" : "TODO",
        completedAt: completed ? day(-1) : null,
        labels: {
          createMany: { data: item.labels.map((labelId) => ({ labelId })) },
        },
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

  return { tasks: created, categories: 3 };
}
