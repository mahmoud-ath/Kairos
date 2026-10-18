import { describe, expect, it } from "vitest";

import { UNCATEGORIZED_ID } from "@/lib/categories";
import {
  buildSections,
  buildViewCounts,
  defaultCategoryId,
  defaultScheduledDate,
  isHabitTask,
  isTaskOverdue,
  selectScopedTasks,
} from "@/lib/views";
import type { TaskLike } from "@/lib/views";

const TODAY = "2026-10-04"; // a Sunday

function task(overrides: Partial<TaskLike> & { id: string }): TaskLike {
  return {
    status: "TODO",
    categoryId: null,
    scheduledDate: null,
    dueDate: null,
    position: 0,
    completedAt: null,
    ...overrides,
  };
}

const undated = task({ id: "undated", position: 0 });
const scheduledToday = task({ id: "today", scheduledDate: TODAY, position: 1 });
const yesterday = task({ id: "yesterday", scheduledDate: "2026-10-03", position: 2 });
const overdueBySchedule = task({ id: "overdue-schedule", scheduledDate: "2026-10-02", position: 3 });
const overdueByDue = task({ id: "overdue-due", dueDate: "2026-10-01", position: 4 });
const overdueBoth = task({
  id: "overdue-both",
  scheduledDate: "2026-10-03",
  dueDate: "2026-09-30",
  position: 5,
});
const upcomingA = task({ id: "up-1", scheduledDate: "2026-10-05", position: 6 });
const upcomingB = task({ id: "up-2", scheduledDate: "2026-10-05", position: 7 });
const upcomingLater = task({ id: "up-3", scheduledDate: "2026-10-09", position: 8 });
const categorized = task({ id: "categorized", categoryId: "cat-1", position: 9 });
const doneToday = task({
  id: "done-today",
  status: "DONE",
  scheduledDate: TODAY,
  completedAt: "2026-10-04T09:00:00.000Z",
  position: 10,
});

const allTasks: TaskLike[] = [
  undated,
  scheduledToday,
  yesterday,
  overdueBySchedule,
  overdueByDue,
  overdueBoth,
  upcomingA,
  upcomingB,
  upcomingLater,
  categorized,
  doneToday,
];

describe("overdue rule", () => {
  it("is unfinished and past its deadline or planned day", () => {
    expect(isTaskOverdue(overdueBySchedule, TODAY)).toBe(true);
    expect(isTaskOverdue(overdueByDue, TODAY)).toBe(true);
    expect(isTaskOverdue(overdueBoth, TODAY)).toBe(true);
    expect(isTaskOverdue(yesterday, TODAY)).toBe(true);
    expect(isTaskOverdue(scheduledToday, TODAY)).toBe(false);
    expect(isTaskOverdue(upcomingA, TODAY)).toBe(false);
    expect(isTaskOverdue(doneToday, TODAY)).toBe(false);
  });

  it("treats a task due today as not overdue", () => {
    expect(isTaskOverdue(task({ id: "due-today", dueDate: TODAY }), TODAY)).toBe(false);
  });
});

describe("today view", () => {
  it("shows only today's tasks and leaves overdue work out", () => {
    const sections = buildSections({
      scope: { kind: "today" },
      tasks: allTasks,
      today: TODAY,
      includeCompleted: false,
    });

    expect(sections.map((section) => section.key)).toEqual(["today"]);
    expect(sections[0].tasks.map((t) => t.id)).toEqual(["today"]);

    // Overdue work is a backlog concern: it lives in All Tasks, grouped under
    // the day that makes it late, and never on the day's own page.
    const ids = sections.flatMap((section) => section.tasks.map((t) => t.id));
    expect(ids).not.toContain("yesterday");
    expect(ids).not.toContain("overdue-schedule");
    expect(ids).not.toContain("overdue-due");
    expect(ids).not.toContain("overdue-both");

    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it("can include completed tasks for today", () => {
    const sections = buildSections({
      scope: { kind: "today" },
      tasks: allTasks,
      today: TODAY,
      includeCompleted: true,
    });
    const completed = sections.find((section) => section.kind === "completed");
    expect(completed?.tasks.map((t) => t.id)).toEqual(["done-today"]);
  });
});

describe("all tasks view", () => {
  it("groups by day, including past days, then unscheduled and completed", () => {
    const sections = buildSections({
      scope: { kind: "all" },
      tasks: allTasks,
      today: TODAY,
      includeCompleted: true,
    });

    expect(sections.map((section) => [section.title, section.kind])).toEqual([
      ["Wed, Sep 30", "past"],
      ["Thu, Oct 1", "past"],
      ["Fri, Oct 2", "past"],
      ["Yesterday", "past"],
      ["Today", "today"],
      ["Tomorrow", "upcoming"],
      ["Fri, Oct 9", "upcoming"],
      ["Unscheduled", "unscheduled"],
      ["Completed", "completed"],
    ]);
  });

  it("shows yesterday as its own group instead of an overdue pile", () => {
    const sections = buildSections({
      scope: { kind: "all" },
      tasks: allTasks,
      today: TODAY,
      includeCompleted: false,
    });
    const yesterdayGroup = sections.find((section) => section.title === "Yesterday");
    expect(yesterdayGroup?.date).toBe("2026-10-03");
    expect(yesterdayGroup?.tasks.map((t) => t.id)).toEqual(["yesterday"]);
  });

  it("puts tasks with no dates in Unscheduled", () => {
    const sections = buildSections({
      scope: { kind: "all" },
      tasks: allTasks,
      today: TODAY,
      includeCompleted: false,
    });
    const unscheduled = sections.find((section) => section.key === "unscheduled");
    expect(unscheduled?.tasks.map((t) => t.id)).toEqual(["undated", "categorized"]);
  });

  it("orders each day by position", () => {
    const sections = buildSections({
      scope: { kind: "all" },
      tasks: allTasks,
      today: TODAY,
      includeCompleted: false,
    });
    const tomorrow = sections.find((section) => section.title === "Tomorrow");
    expect(tomorrow?.tasks.map((t) => t.id)).toEqual(["up-1", "up-2"]);
  });
});

describe("completed view", () => {
  it("orders by completion time, newest first", () => {
    const older = task({
      id: "older",
      status: "DONE",
      completedAt: "2026-10-01T08:00:00.000Z",
    });
    const sections = buildSections({
      scope: { kind: "completed" },
      tasks: [older, doneToday],
      today: TODAY,
      includeCompleted: true,
    });
    expect(sections[0].tasks.map((t) => t.id)).toEqual(["done-today", "older"]);
  });
});

describe("category view", () => {
  it("only shows tasks in that category", () => {
    const sections = buildSections({
      scope: { kind: "category", categoryId: "cat-1" },
      tasks: allTasks,
      today: TODAY,
      includeCompleted: false,
    });
    const ids = sections.flatMap((section) => section.tasks.map((t) => t.id));
    expect(ids).toEqual(["categorized"]);
  });

  it("groups a category into overdue, today, upcoming and unscheduled", () => {
    const categorizedTasks = [
      task({ id: "c-overdue", categoryId: "cat-1", scheduledDate: "2026-10-02" }),
      task({ id: "c-today", categoryId: "cat-1", scheduledDate: TODAY }),
      task({ id: "c-up", categoryId: "cat-1", scheduledDate: "2026-10-09" }),
      task({ id: "c-none", categoryId: "cat-1" }),
      task({ id: "other", categoryId: "cat-2", scheduledDate: TODAY }),
    ];
    const sections = buildSections({
      scope: { kind: "category", categoryId: "cat-1" },
      tasks: categorizedTasks,
      today: TODAY,
      includeCompleted: false,
    });
    expect(sections.map((section) => section.key)).toEqual([
      "overdue",
      "today",
      "date:2026-10-09",
      "unscheduled",
    ]);
  });
});

describe("view counts", () => {
  it("counts unfinished tasks only, and agrees with the views", () => {
    const counts = buildViewCounts(allTasks, TODAY);
    expect(counts.today).toBe(1); // only what is planned for today
    expect(counts.overdue).toBe(4);
    expect(counts.all).toBe(10); // every unfinished task
    expect(counts.completed).toBe(1);
    expect(counts.open).toBe(10);
    expect(counts.unscheduled).toBe(2);
    expect(counts.byCategory).toEqual({ "cat-1": 1, [UNCATEGORIZED_ID]: 9 });
  });

  it("never shows a task twice in one view", () => {
    const scoped = selectScopedTasks({ kind: "today" }, allTasks, TODAY);
    expect(scoped.map((t) => t.id)).toEqual(["today", "done-today"]);
    expect(new Set(scoped.map((t) => t.id)).size).toBe(scoped.length);
  });

  it("counts every open task exactly once in All Tasks", () => {
    const ids = selectScopedTasks({ kind: "all" }, allTasks, TODAY).map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBe(allTasks.length);
  });
});

describe("quick-add defaults", () => {
  it("dates a new task to the day it is created in, in every view", () => {
    expect(defaultScheduledDate({ kind: "today" }, TODAY)).toBe(TODAY);
    expect(defaultScheduledDate({ kind: "all" }, TODAY)).toBe(TODAY);
    expect(defaultScheduledDate({ kind: "completed" }, TODAY)).toBe(TODAY);
    expect(defaultScheduledDate({ kind: "category", categoryId: "cat-1" }, TODAY)).toBe(TODAY);
  });

  it("defaults a category view to that category", () => {
    expect(defaultCategoryId({ kind: "category", categoryId: "cat-1" })).toBe("cat-1");
    expect(defaultCategoryId({ kind: "today" })).toBeNull();
  });
});

describe("habit instances are quarantined to Today", () => {
  // One habit instance planned today, one already completed today, and one that
  // a habit generated for a day that is now in the past.
  const habitToday = task({
    id: "habit-today",
    scheduledDate: TODAY,
    categoryId: "cat-1",
    habitId: "habit-1",
    position: 20,
  });
  const habitDoneToday = task({
    id: "habit-done",
    status: "DONE",
    scheduledDate: TODAY,
    completedAt: "2026-10-04T07:00:00.000Z",
    habitId: "habit-1",
    position: 21,
  });
  const habitStale = task({
    id: "habit-stale",
    scheduledDate: "2026-10-02",
    habitId: "habit-1",
    position: 22,
  });
  const tasks = [...allTasks, habitToday, habitDoneToday, habitStale];

  it("shows them in Today, next to the day's own tasks", () => {
    const sections = buildSections({
      scope: { kind: "today" },
      tasks,
      today: TODAY,
      includeCompleted: true,
    });

    expect(sections.map((section) => section.key)).toEqual(["today", "completed"]);
    expect(sections[0].tasks.map((t) => t.id)).toEqual(["today", "habit-today"]);
    // Ticking a habit instance off keeps it visible for the rest of the day.
    expect(sections[1].tasks.map((t) => t.id)).toEqual(["done-today", "habit-done"]);
  });

  it("leaves them out of All Tasks, Completed and category views", () => {
    const scoped = [
      selectScopedTasks({ kind: "all" }, tasks, TODAY),
      selectScopedTasks({ kind: "completed" }, tasks, TODAY),
      selectScopedTasks({ kind: "category", categoryId: "cat-1" }, tasks, TODAY),
    ].flatMap((list) => list.map((t) => t.id));

    expect(scoped).not.toContain("habit-today");
    expect(scoped).not.toContain("habit-done");
    expect(scoped).not.toContain("habit-stale");
  });

  it("counts them in Today and in their own badge, and nowhere else", () => {
    const counts = buildViewCounts(tasks, TODAY);
    expect(counts.today).toBe(2); // today's task plus the open habit instance
    expect(counts.habits).toBe(1); // only the habit still open today
    expect(counts.all).toBe(10); // habit instances are not part of All Tasks
    expect(counts.open).toBe(10);
    expect(counts.completed).toBe(1);
    expect(counts.overdue).toBe(4); // the stale instance is not overdue work
    expect(counts.unscheduled).toBe(2);
    expect(counts.byCategory).toEqual({ "cat-1": 1, [UNCATEGORIZED_ID]: 9 });
  });

  it("recognises a habit instance by its habit link", () => {
    expect(isHabitTask(habitToday)).toBe(true);
    expect(isHabitTask(scheduledToday)).toBe(false);
  });
});
