import {
  BarChart3,
  BellRing,
  CalendarDays,
  Command,
  Download,
  FolderTree,
  ListTree,
  Repeat,
  ShieldCheck,
} from "lucide-react";

/**
 * Feature list.
 *
 * Every entry describes something the app actually does today, including the
 * parts added after this page was first written: habits, the daily reminder,
 * icons and colours on categories, and keyboard shortcuts. There are still no
 * testimonials, user counts or benchmarks — and nothing about calendar sync,
 * teams, collaboration, labels, priorities, attachments, email digests or
 * per-task reminders, none of which exist.
 */
const FEATURES = [
  {
    icon: CalendarDays,
    title: "Today, and everything else",
    description:
      "Today shows what is due now. All Tasks lists the rest grouped by day, latest first, with anything undated collected at the end under Unscheduled.",
  },
  {
    icon: Repeat,
    title: "Habits that come back on their own",
    description:
      "Pick the weekdays a habit should happen and today's instance appears in Today. A missed day is simply missing, never a backlog — and a month grid with a 30-day trend shows the streak.",
  },
  {
    icon: FolderTree,
    title: "Categories with a colour and an icon",
    description:
      "One category per task, each with its own colour and icon in the sidebar. Work you have not filed yet collects in an Uncategorized bucket instead of disappearing.",
  },
  {
    icon: ListTree,
    title: "Subtasks and drag and drop",
    description:
      "Break a task into one level of subtasks — they inherit the parent's category — then reorder with the pointer or the keyboard. Dropping a task onto another nests it.",
  },
  {
    icon: BarChart3,
    title: "Statistics that explain the week",
    description:
      "A completion donut, a 7- or 30-day history and a breakdown by category, so you can see where the week went instead of just a total. Habit check-ins are counted apart from tasks.",
  },
  {
    icon: BellRing,
    title: "A reminder at the hour you choose",
    description:
      "Switch on one daily push notification and pick the hour — it is read in your own timezone. Nothing is sent until you enable it on a device, there are no per-task pings, and it stops with one tap.",
  },
  {
    icon: Command,
    title: "Keyboard-first, and filterable",
    description:
      "Shift + T for Today, Shift + H for Habits, / to filter, n for a new task, ? for the full list — all of it also works with a pointer, and the filter box sits in the top bar.",
  },
  {
    icon: Download,
    title: "JSON backup that includes habits",
    description:
      "Export tasks, subtasks, habits, categories, history and settings as one versioned JSON file, then import it back. Nothing is locked in.",
  },
  {
    icon: ShieldCheck,
    title: "Private by construction, open source",
    description:
      "Each account gets its own workspace, and that separation is enforced in the data layer rather than only hidden in the interface. MIT licensed: use the hosted version, or run your own against your own PostgreSQL.",
  },
] as const;

export function Features() {
  return (
    <section id="features" className="scroll-mt-20 border-t border-border/70 bg-muted/30">
      <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold text-primary">Features</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            Everything you need to finish what you started
          </h2>
          <p className="mt-3 text-base leading-relaxed text-muted-foreground">
            Kairos is deliberately small. It keeps the parts that help you decide what to
            do next — a day view, habits, categories and a weekly read — and leaves out
            the parts that turn a task list into another project.
          </p>
        </div>

        <ul className="mt-12 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <li key={feature.title}>
              <span className="grid h-9 w-9 place-items-center rounded-md bg-primary/10 text-primary">
                <feature.icon className="h-4.5 w-4.5" />
              </span>
              <h3 className="mt-4 text-base font-semibold tracking-tight">
                {feature.title}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                {feature.description}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
