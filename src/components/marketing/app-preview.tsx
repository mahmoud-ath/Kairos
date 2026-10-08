import {
  CalendarDays,
  Check,
  CircleCheckBig,
  GripVertical,
  ListTodo,
  Plus,
  Search,
} from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * An illustrative preview of the Kairos workspace.
 *
 * This is deliberately **not** the real application. It is static markup with
 * fictional tasks: it performs no queries, reads no session, and imports none of
 * the data-driven workspace components. Mounting the authenticated shell on a
 * public page would couple the landing page to the database and defeat static
 * rendering.
 *
 * It is presented as a single image to assistive technology — the inner text is
 * decorative, and a screen reader gets the summary in `aria-label` instead of
 * fifty disconnected words and numbers.
 */

type PreviewTask = {
  title: string;
  category?: string;
  due?: string;
  subtasks?: string;
  done?: boolean;
};

const SECTIONS: { label: string; tasks: PreviewTask[] }[] = [
  {
    label: "Today",
    tasks: [
      { title: "Draft the Q3 roadmap", category: "Work", subtasks: "2/4", due: "Today" },
      { title: "Review pull requests", category: "Work" },
      { title: "Book the dentist", category: "Personal", due: "Oct 12" },
      { title: "Send the Q3 invoice", category: "Work", done: true },
    ],
  },
  {
    label: "Tomorrow",
    tasks: [
      { title: "Outline the themes", category: "Work" },
      { title: "Replace the kitchen filter", category: "Personal" },
    ],
  },
  {
    label: "Unscheduled",
    tasks: [{ title: "Finish the TypeScript course", category: "Learning" }],
  },
];

const CATEGORIES = [
  { name: "Work", color: "#3b82f6", count: 5 },
  { name: "Personal", color: "#22c55e", count: 4 },
  { name: "Learning", color: "#8b5cf6", count: 3 },
];

/** Seven days of completions, for the progress panel's mini chart. */
const WEEK = [2, 3, 1, 4, 2, 5, 3];

export function AppPreview() {
  return (
    <figure
      role="img"
      aria-label="Preview of the Kairos workspace: a sidebar listing today, all tasks, completed and categories, a task list grouped by day with subtask counts and categories, and a progress panel showing 7 of 12 tasks complete."
      className="overflow-hidden rounded-lg border border-border bg-card shadow-sm"
    >
      <div aria-hidden="true" className="flex min-h-[26rem] text-[13px]">
        {/* Sidebar */}
        <div className="hidden w-52 shrink-0 flex-col border-r border-sidebar-border bg-sidebar p-4 lg:flex">
          <div className="flex items-center gap-2.5">
            <span className="grid h-7 w-7 place-items-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
              K
            </span>
            <span className="text-sm font-semibold tracking-tight">Kairos</span>
          </div>

          <nav className="mt-6 flex flex-col gap-0.5 text-sidebar-foreground">
            <SidebarRow icon={<CalendarDays className="h-4 w-4" />} label="Today" count={4} active />
            <SidebarRow icon={<ListTodo className="h-4 w-4" />} label="All Tasks" count={12} />
            <SidebarRow icon={<CircleCheckBig className="h-4 w-4" />} label="Completed" count={7} />
          </nav>

          <p className="mt-6 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Categories
          </p>
          <nav className="mt-2 flex flex-col gap-0.5 text-sidebar-foreground">
            {CATEGORIES.map((category) => (
              <div
                key={category.name}
                className="flex items-center gap-2 rounded-md px-2 py-1.5"
              >
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: category.color }}
                />
                <span className="truncate">{category.name}</span>
                <span className="ml-auto text-xs text-muted-foreground">{category.count}</span>
              </div>
            ))}
          </nav>
        </div>

        {/* Workspace */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center gap-3 border-b border-border px-5 py-3.5">
            <span className="text-base font-semibold tracking-tight">All Tasks</span>
            <span className="ml-auto hidden items-center gap-1.5 rounded-md border border-input px-2.5 py-1 text-xs text-muted-foreground sm:flex">
              <Search className="h-3.5 w-3.5" />
              Search
            </span>
            <span className="rounded-md border border-input px-2.5 py-1 text-xs text-muted-foreground">
              Work
            </span>
          </div>

          <div className="px-5 pt-4">
            <div className="flex items-center gap-2 rounded-md border border-dashed border-input px-3 py-2 text-muted-foreground">
              <Plus className="h-3.5 w-3.5" />
              Add a task and press Enter…
            </div>
          </div>

          <div className="flex-1 px-5 pb-5 pt-4">
            {SECTIONS.map((section) => (
              <div key={section.label} className="mb-4 last:mb-0">
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {section.label}
                </p>
                <div className="divide-y divide-border/70 border-y border-border/70">
                  {section.tasks.map((task) => (
                    <TaskRow key={task.title} task={task} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Progress panel */}
        <div className="hidden w-52 shrink-0 flex-col gap-5 border-l border-border p-4 xl:flex">
          <div>
            <p className="text-sm font-semibold tracking-tight">Progress</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight">58%</p>
            <p className="text-xs text-muted-foreground">7 of 12 complete</p>
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: "58%" }} />
            </div>
          </div>

          <div className="flex flex-col gap-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Completed</span>
              <span className="font-medium">7</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Remaining</span>
              <span className="font-medium">5</span>
            </div>
          </div>

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Completed this week
            </p>
            <div className="mt-2 flex h-12 items-end gap-1.5">
              {WEEK.map((value, index) => (
                <div
                  key={index}
                  className="flex-1 rounded-sm bg-primary/25"
                  style={{ height: `${(value / 5) * 100}%` }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </figure>
  );
}

function SidebarRow({
  icon,
  label,
  count,
  active,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  active?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-md px-2 py-1.5",
        active && "bg-sidebar-accent font-medium",
      )}
    >
      {icon}
      <span className="truncate">{label}</span>
      <span className="ml-auto text-xs text-muted-foreground">{count}</span>
    </div>
  );
}

function TaskRow({ task }: { task: PreviewTask }) {
  return (
    <div className="flex items-center gap-2.5 py-2">
      <GripVertical className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />

      {task.done ? (
        <span className="grid h-4 w-4 shrink-0 place-items-center rounded border border-primary bg-primary text-primary-foreground">
          <Check className="h-3 w-3" />
        </span>
      ) : (
        <span className="h-4 w-4 shrink-0 rounded border border-input" />
      )}

      <span className={cn("truncate", task.done && "text-muted-foreground line-through")}>
        {task.title}
      </span>

      {task.subtasks ? (
        <span className="shrink-0 rounded border border-border px-1.5 text-[10px] text-muted-foreground">
          {task.subtasks}
        </span>
      ) : null}

      <span className="ml-auto flex shrink-0 items-center gap-2">
        {task.category ? (
          <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] text-accent-foreground">
            {task.category}
          </span>
        ) : null}
        {task.due ? (
          <span className="text-[11px] text-muted-foreground">{task.due}</span>
        ) : null}
      </span>
    </div>
  );
}
