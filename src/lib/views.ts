/**
 * View grouping rules.
 *
 * These functions are pure and generic over any task-like shape, so the same
 * rules drive the task list (full DTOs), the sidebar counters and the
 * right-hand progress panel (lightweight summaries). A task is only ever placed
 * in one section per view.
 */

import { addDays, compareDateOnly, formatRelativeDate } from "@/lib/dates";
import type { TaskStatus } from "@/types/kairos";

export type TaskLike = {
  id: string;
  status: TaskStatus;
  categoryId: string | null;
  scheduledDate: string | null;
  dueDate: string | null;
  position: number;
  completedAt?: string | null;
};

export type SectionKind =
  | "past"
  | "today"
  | "upcoming"
  | "unscheduled"
  | "completed"
  | "all";

export type TaskSection<T extends TaskLike = TaskLike> = {
  /** Stable key for React and for drag-and-drop droppables. */
  key: string;
  title: string;
  kind: SectionKind;
  /** The date this group represents, otherwise `null`. */
  date: string | null;
  tasks: T[];
};

export type ViewScope =
  | { kind: "today" }
  | { kind: "upcoming" }
  | { kind: "all" }
  | { kind: "completed" }
  | { kind: "category"; categoryId: string };

export type GroupOptions<T extends TaskLike> = {
  scope: ViewScope;
  tasks: readonly T[];
  today: string;
  /** Whether completed tasks are part of the current filter selection. */
  includeCompleted: boolean;
};

/**
 * A task is overdue when it is unfinished and either its deadline or its
 * planned day has already passed.
 *
 * ("due date has passed, or scheduled date has passed, and it remains
 * unfinished" → unfinished AND (due passed OR scheduled passed).)
 */
export function isTaskOverdue(task: TaskLike, today: string): boolean {
  if (task.status === "DONE") return false;
  const scheduledPassed =
    task.scheduledDate !== null && compareDateOnly(task.scheduledDate, today) < 0;
  const duePassed = task.dueDate !== null && compareDateOnly(task.dueDate, today) < 0;
  return scheduledPassed || duePassed;
}

export function isDone(task: TaskLike): boolean {
  return task.status === "DONE";
}

/** The day a task is anchored to for grouping: planned day first, then deadline. */
export function taskAnchorDate(task: TaskLike): string | null {
  return task.scheduledDate ?? task.dueDate ?? null;
}

/**
 * Anchor used by date-grouped views (All Tasks).
 *
 * Overdue work is grouped under the day that makes it late (its deadline, or
 * its planned day when there is no deadline) so nothing hides in the future.
 */
export function groupedAnchorDate(task: TaskLike, today: string): string | null {
  if (isTaskOverdue(task, today)) {
    return task.dueDate ?? task.scheduledDate ?? null;
  }
  return taskAnchorDate(task);
}

function sortTasks<T extends TaskLike>(tasks: readonly T[]): T[] {
  return [...tasks].sort((a, b) => {
    if (a.position !== b.position) return a.position - b.position;
    return a.id < b.id ? -1 : 1;
  });
}

function plainSection<T extends TaskLike>(
  key: string,
  title: string,
  kind: SectionKind,
  tasks: readonly T[],
  date: string | null = null,
): TaskSection<T> {
  return { key, title, kind, date, tasks: sortTasks(tasks) };
}

function dateSection<T extends TaskLike>(
  date: string,
  today: string,
  tasks: readonly T[],
): TaskSection<T> {
  const comparison = compareDateOnly(date, today);
  return plainSection(
    `date:${date}`,
    formatRelativeDate(date, today),
    comparison === 0 ? "today" : comparison < 0 ? "past" : "upcoming",
    tasks,
    date,
  );
}

/** Completed tasks are ordered by completion time, newest first. */
function completedSection<T extends TaskLike>(tasks: readonly T[]): TaskSection<T> {
  const sorted = [...tasks].sort((a, b) => {
    const aTime = a.completedAt ? Date.parse(a.completedAt) : 0;
    const bTime = b.completedAt ? Date.parse(b.completedAt) : 0;
    if (aTime !== bTime) return bTime - aTime;
    return a.id < b.id ? -1 : 1;
  });
  return {
    key: "completed",
    title: "Completed",
    kind: "completed",
    date: null,
    tasks: sorted,
  };
}

type Buckets<T extends TaskLike> = {
  overdue: T[];
  today: T[];
  upcoming: Map<string, T[]>;
  upcomingDates: string[];
  unscheduled: T[];
};

/** Split tasks into overdue / today / future-dated / unscheduled buckets. */
export function bucketByDate<T extends TaskLike>(
  tasks: readonly T[],
  today: string,
): Buckets<T> {
  const overdue: T[] = [];
  const todayTasks: T[] = [];
  const upcoming = new Map<string, T[]>();
  const unscheduled: T[] = [];

  for (const task of tasks) {
    if (isTaskOverdue(task, today)) {
      overdue.push(task);
      continue;
    }
    const anchor = taskAnchorDate(task);
    if (!anchor) {
      unscheduled.push(task);
      continue;
    }
    const comparison = compareDateOnly(anchor, today);
    if (comparison === 0) {
      todayTasks.push(task);
    } else if (comparison > 0) {
      const bucket = upcoming.get(anchor) ?? [];
      bucket.push(task);
      upcoming.set(anchor, bucket);
    } else {
      unscheduled.push(task);
    }
  }

  return {
    overdue,
    today: todayTasks,
    upcoming,
    upcomingDates: [...upcoming.keys()].sort(compareDateOnly),
    unscheduled,
  };
}

/** Group tasks by the day they belong to (past days included). */
function groupByDay<T extends TaskLike>(
  tasks: readonly T[],
  today: string,
): { dates: string[]; byDate: Map<string, T[]>; unscheduled: T[] } {
  const byDate = new Map<string, T[]>();
  const unscheduled: T[] = [];

  for (const task of tasks) {
    const anchor = groupedAnchorDate(task, today);
    if (!anchor) {
      unscheduled.push(task);
      continue;
    }
    const bucket = byDate.get(anchor) ?? [];
    bucket.push(task);
    byDate.set(anchor, bucket);
  }

  return { dates: [...byDate.keys()].sort(compareDateOnly), byDate, unscheduled };
}

/** Which completed tasks still belong to a given view. */
function matchesDoneScope(scope: ViewScope, task: TaskLike, today: string): boolean {
  switch (scope.kind) {
    case "today": {
      const anchor = taskAnchorDate(task);
      return anchor !== null && compareDateOnly(anchor, today) === 0;
    }
    case "upcoming": {
      const anchor = taskAnchorDate(task);
      return anchor !== null && compareDateOnly(anchor, today) > 0;
    }
    case "category":
      return task.categoryId === scope.categoryId;
    default:
      return true;
  }
}

/**
 * Build the sections rendered by the task workspace.
 *
 * `tasks` should already contain every task in scope; search and filter controls
 * narrow the list before this runs (see `applyFilters`).
 */
export function buildSections<T extends TaskLike>({
  scope,
  tasks,
  today,
  includeCompleted,
}: GroupOptions<T>): TaskSection<T>[] {
  if (scope.kind === "completed") {
    const done = tasks.filter(isDone);
    return done.length > 0 ? [completedSection(done)] : [];
  }

  // Open tasks are grouped by date; completed tasks only ever appear in the
  // dedicated Completed section, so a task is never listed twice.
  const visible = tasks.filter((task) => !isDone(task));
  const done = includeCompleted
    ? tasks.filter((task) => isDone(task) && matchesDoneScope(scope, task, today))
    : [];

  switch (scope.kind) {
    case "today": {
      // Exactly two groups: anything overdue, then what is planned for (or due)
      // today. A task only ever appears in one of them.
      const overdue: T[] = [];
      const dueToday: T[] = [];
      for (const task of visible) {
        if (isTaskOverdue(task, today)) {
          overdue.push(task);
          continue;
        }
        const anchor = taskAnchorDate(task);
        if (anchor && compareDateOnly(anchor, today) === 0) dueToday.push(task);
      }
      const sections: TaskSection<T>[] = [];
      if (overdue.length > 0) {
        sections.push(plainSection("overdue", "Overdue", "past", overdue));
      }
      sections.push(plainSection("today", "Today", "today", dueToday, today));
      if (done.length > 0) sections.push(completedSection(done));
      return sections;
    }

    case "upcoming": {
      const buckets = bucketByDate(visible, today);
      const sections: TaskSection<T>[] = [];
      if (buckets.overdue.length > 0) {
        sections.push(plainSection("overdue", "Overdue", "past", buckets.overdue));
      }
      // Today is included so a task created here (which is dated today) stays
      // visible instead of silently disappearing.
      if (buckets.today.length > 0) {
        sections.push(plainSection("today", "Today", "today", buckets.today, today));
      }
      for (const date of buckets.upcomingDates) {
        sections.push(dateSection(date, today, buckets.upcoming.get(date) ?? []));
      }
      if (done.length > 0) sections.push(completedSection(done));
      return sections;
    }

    case "all": {
      // Every day that has work, oldest first — so yesterday and earlier days
      // are visible instead of being folded into a single "overdue" pile.
      const { dates, byDate, unscheduled } = groupByDay(visible, today);
      const sections: TaskSection<T>[] = dates.map((date) =>
        dateSection(date, today, byDate.get(date) ?? []),
      );
      if (unscheduled.length > 0) {
        sections.push(
          plainSection("unscheduled", "Unscheduled", "unscheduled", unscheduled),
        );
      }
      if (done.length > 0) sections.push(completedSection(done));
      return sections;
    }

    case "category": {
      const scoped = visible.filter((task) => task.categoryId === scope.categoryId);
      const buckets = bucketByDate(scoped, today);
      const sections: TaskSection<T>[] = [];
      if (buckets.overdue.length > 0) {
        sections.push(plainSection("overdue", "Overdue", "past", buckets.overdue));
      }
      if (buckets.today.length > 0) {
        sections.push(plainSection("today", "Today", "today", buckets.today, today));
      }
      for (const date of buckets.upcomingDates) {
        sections.push(dateSection(date, today, buckets.upcoming.get(date) ?? []));
      }
      if (buckets.unscheduled.length > 0) {
        sections.push(
          plainSection("unscheduled", "Unscheduled", "unscheduled", buckets.unscheduled),
        );
      }
      if (done.length > 0) sections.push(completedSection(done));
      return sections;
    }
  }
}

/** Every task that belongs to `scope`, using the same rules as the task list. */
export function selectScopedTasks<T extends TaskLike>(
  scope: ViewScope,
  tasks: readonly T[],
  today: string,
): T[] {
  return buildSections({ scope, tasks, today, includeCompleted: true }).flatMap(
    (section) => section.tasks,
  );
}

export type ViewCounts = {
  today: number;
  upcoming: number;
  overdue: number;
  all: number;
  completed: number;
  open: number;
  unscheduled: number;
  /** Unfinished top-level tasks per category id. */
  byCategory: Record<string, number>;
};

/**
 * Counters for the sidebar and the progress panel, derived from the same
 * grouping rules the task list uses so the numbers always agree.
 */
export function buildViewCounts(tasks: readonly TaskLike[], today: string): ViewCounts {
  const open = tasks.filter((task) => task.status === "TODO");
  const done = tasks.filter(isDone);

  // Sidebar counters show unfinished work, so they are derived from the same
  // grouping rules the task list uses — with completed tasks left out.
  const countOpen = (scope: ViewScope) =>
    buildSections({ scope, tasks: open, today, includeCompleted: false }).reduce(
      (total, section) => total + section.tasks.length,
      0,
    );

  const byCategory: Record<string, number> = {};
  for (const task of open) {
    if (!task.categoryId) continue;
    byCategory[task.categoryId] = (byCategory[task.categoryId] ?? 0) + 1;
  }

  const unscheduled = open.filter((task) => groupedAnchorDate(task, today) === null).length;

  return {
    today: countOpen({ kind: "today" }),
    upcoming: countOpen({ kind: "upcoming" }),
    overdue: open.filter((task) => isTaskOverdue(task, today)).length,
    all: open.length,
    completed: done.length,
    open: open.length,
    unscheduled,
    byCategory,
  };
}

/**
 * Default planned date applied by quick-add.
 *
 * Every new task is attached to the day it is created in, so nothing piles up
 * in an undated list. The field stays editable before and after creating it.
 */
export function defaultScheduledDate(_scope: ViewScope, today: string): string | null {
  return today;
}

/** Default category applied by quick-add for a given view. */
export function defaultCategoryId(scope: ViewScope): string | null {
  return scope.kind === "category" ? scope.categoryId : null;
}

/** Tomorrow's date, used by the "reschedule" shortcuts. */
export function tomorrow(today: string): string {
  return addDays(today, 1);
}
