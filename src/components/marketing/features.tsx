import {
  BarChart3,
  CalendarDays,
  Code2,
  Download,
  FolderTree,
  GripVertical,
  ListTree,
  Palette,
  ShieldCheck,
} from "lucide-react";

/**
 * Feature list.
 *
 * Every entry describes something the app actually does today. There are no
 * testimonials, user counts, benchmarks or security claims — and nothing about
 * recurring tasks, reminders, notifications, calendar sync, teams,
 * collaboration, labels, priorities or attachments, none of which exist.
 */
const FEATURES = [
  {
    icon: CalendarDays,
    title: "Today, and everything else",
    description:
      "Today shows what is due now. All Tasks shows the rest, grouped by day, with anything undated collected at the end under Unscheduled.",
  },
  {
    icon: FolderTree,
    title: "Organised by category and date",
    description:
      "Group work by category and schedule it across past, present and future days. There is no inbox to triage first.",
  },
  {
    icon: ListTree,
    title: "Subtasks, one level deep",
    description:
      "Break a task into subtasks and watch the counter move as you finish them. A subtask keeps its parent's category.",
  },
  {
    icon: GripVertical,
    title: "Drag and drop",
    description:
      "Reorder tasks and move them between days with the pointer — or from the keyboard, which the drag handles support too.",
  },
  {
    icon: BarChart3,
    title: "Completion tracking",
    description:
      "Every completion is recorded, so the statistics page can show where your progress actually came from instead of just a total.",
  },
  {
    icon: Palette,
    title: "Theme and preferences",
    description:
      "Light, dark or follow your system, plus your timezone and which day your week starts — applied consistently across the app.",
  },
  {
    icon: Download,
    title: "JSON backup and export",
    description:
      "Export tasks, subtasks, categories, history and settings as a versioned JSON file, and import it back. Your data stays portable.",
  },
  {
    icon: ShieldCheck,
    title: "Your own private workspace",
    description:
      "Each account gets its own tasks, categories and settings. That separation is enforced in the data layer, not just hidden in the interface.",
  },
  {
    icon: Code2,
    title: "Open source and self-hostable",
    description:
      "MIT licensed. Use the hosted version, or run your own copy against your own PostgreSQL database and keep everything in-house.",
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
            do next, and leaves out the parts that turn a task list into another project.
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
