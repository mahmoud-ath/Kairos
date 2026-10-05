import { describe, expect, it } from "vitest";

import { buildSections, buildViewCounts, isTaskOverdue, selectScopedTasks } from "@/lib/views";
import type { TaskLike } from "@/lib/views";

const TODAY = "2026-10-04";

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

const inboxTask = task({ id: "inbox", position: 0 });

const scheduledToday = task({ id: "today", scheduledDate: TODAY, position: 1 });

const overdueBySchedule = task({
  id: "overdue-schedule",
  scheduledDate: "2026-10-02",
  position: 2,
});

const overdueByDue = task({ id: "overdue-due", dueDate: "2026-10-01", position: 3 });

const overdueBoth = task({
  id: "overdue-both",
  scheduledDate: "2026-10-03",
  dueDate: "2026-09-30",
  position: 4,
});

const upcomingA = task({ id: "up-1", scheduledDate: "2026-10-05", position: 5 });
const upcomingB = task({ id: "up-2", scheduledDate: "2026-10-05", position: 6 });
const upcomingLater = task({ id: "up-3", scheduledDate: "2026-10-09", position: 7 });

const unscheduled = task({ id: "unscheduled", categoryId: "cat-1", position: 8 });

const doneToday = task({
  id: "done-today",
  status: "DONE",
  scheduledDate: TODAY,
  completedAt: "2026-10-04T09:00:00.000Z",
  position: 9,
});

const allTasks: TaskLike[] = [
  inboxTask,
  scheduledToday,
  overdueBySchedule,
  overdueByDue,
  overdueBoth,
  upcomingA,
  upcomingB,
  upcomingLater,
  unscheduled,
  doneToday,
];

describe("overdue rule", () => {
  it("is unfinished and past its deadline or planned day", () => {
    expect(isTaskOverdue(overdueBySchedule, TODAY)).toBe(true);
    expect(isTaskOverdue(overdueByDue, TODAY)).toBe(true);
    expect(isTaskOverdue(overdueBoth, TODAY)).toBe(true);
    expect(isTaskOverdue(scheduledToday, TODAY)).toBe(false);
    expect(isTaskOverdue(upcomingA, TODAY)).toBe(false);
    expect(isTaskOverdue(doneToday, TODAY)).toBe(false);
  });

  it("treats a task due today as not overdue", () => {
    expect(isTaskOverdue(task({ id: "due-today", dueDate: TODAY }), TODAY)).toBe(false);
  });
});

describe("inbox view", () => {
  it("shows unfinished tasks with no category and no planned day", () => {
    const sections = buildSections({
      scope: { kind: "inbox" },
      tasks: allTasks,
      today: TODAY,
      includeCompleted: false,
    });
    expect(sections).toHaveLength(1);
    // A task that only has a deadline still counts as unscheduled.
    expect(sections[0].tasks.map((t) => t.id)).toEqual(["inbox", "overdue-due"]);
  });
});

describe("today view", () => {
  it("separates overdue tasks from today's tasks and shows each once", () => {
    const sections = buildSections({
      scope: { kind: "today" },
      tasks: allTasks,
      today: TODAY,
      includeCompleted: false,
    });

    expect(sections.map((section) => section.key)).toEqual(["overdue", "today"]);
    expect(sections[0].title).toBe("Overdue");
    expect(sections[0].tasks.map((t) => t.id)).toEqual([
      "overdue-schedule",
      "overdue-due",
      "overdue-both",
    ]);
    expect(sections[1].tasks.map((t) => t.id)).toEqual(["today"]);

    const ids = sections.flatMap((section) => section.tasks.map((t) => t.id));
    expect(new Set(ids).size).toBe(ids.length);
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

describe("upcoming view", () => {
  it("groups future work by date and keeps overdue at the top", () => {
    const sections = buildSections({
      scope: { kind: "upcoming" },
      tasks: allTasks,
      today: TODAY,
      includeCompleted: false,
    });

    expect(sections[0].key).toBe("overdue");
    expect(sections.slice(1).map((section) => [section.title, section.tasks.length])).toEqual([
      ["Tomorrow", 2],
      ["Fri, Oct 9", 1],
    ]);
  });

  it("orders tasks inside a day by position", () => {
    const sections = buildSections({
      scope: { kind: "upcoming" },
      tasks: allTasks,
      today: TODAY,
      includeCompleted: false,
    });
    expect(sections[1].tasks.map((t) => t.id)).toEqual(["up-1", "up-2"]);
  });
});

describe("all tasks view", () => {
  it("groups into overdue, today, upcoming and unscheduled", () => {
    const sections = buildSections({
      scope: { kind: "all" },
      tasks: allTasks,
      today: TODAY,
      includeCompleted: true,
    });
    expect(sections.map((section) => section.key)).toEqual([
      "overdue",
      "today",
      "date:2026-10-05",
      "date:2026-10-09",
      "unscheduled",
      "completed",
    ]);
    const completed = sections.at(-1);
    expect(completed?.tasks.map((t) => t.id)).toEqual(["done-today"]);
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
    expect(ids).toEqual(["unscheduled"]);
  });
});

describe("view counts", () => {
  it("counts unfinished tasks only, and agrees with the views", () => {
    const counts = buildViewCounts(allTasks, TODAY);
    expect(counts.inbox).toBe(2); // inbox + a task that only has a deadline
    expect(counts.today).toBe(4); // 3 overdue + 1 planned for today
    expect(counts.upcoming).toBe(6); // overdue + the three future tasks
    expect(counts.overdue).toBe(3);
    expect(counts.all).toBe(9); // every unfinished task
    expect(counts.completed).toBe(1);
    expect(counts.open).toBe(9);
    expect(counts.byCategory).toEqual({ "cat-1": 1 });
  });

  it("never shows a task twice in one view", () => {
    const scoped = selectScopedTasks({ kind: "today" }, allTasks, TODAY);
    expect(scoped.map((t) => t.id)).toEqual([
      "overdue-schedule",
      "overdue-due",
      "overdue-both",
      "today",
      "done-today",
    ]);
    expect(new Set(scoped.map((t) => t.id)).size).toBe(scoped.length);
  });
});
