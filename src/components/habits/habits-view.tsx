"use client";

import {
  BookOpenCheck,
  Check,
  Flame,
  MoreHorizontal,
  Pause,
  Pencil,
  Play,
  Plus,
  Repeat,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { useAppData } from "@/components/app-data";
import { HabitDialog } from "@/components/habits/habit-dialog";
import { HabitMonthGrid } from "@/components/habits/habit-month-grid";
import { HabitTrend } from "@/components/habits/habit-trend";
import { CategoryGlyph } from "@/components/taxonomy/category-glyph";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  describeHabitCadence,
  type HabitDay,
  type HabitTrendPoint,
  type HabitTrendWindow,
} from "@/lib/habits";
import { monthParamValue } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type {
  CategoryDTO,
  HabitDTO,
  HabitMonth,
  HabitProgress,
} from "@/types/kairos";
import { loadExampleTasksAction } from "@/server/actions/examples";
import { deleteHabitAction, updateHabitAction } from "@/server/actions/habits";
import { createCategoryAction } from "@/server/actions/taxonomy";

/**
 * The habits page.
 *
 * Three parts, in order: the month grid (the tracker), the 30-day trend, and the
 * list of habits with their configuration. Giving a day a status happens on the
 * generated task in Today, or by tapping a cell in the grid — never by editing
 * the habit, which only ever describes what repeats.
 */
export function HabitsView({
  habits,
  progress,
  trend,
  trendWindow,
  grid,
  month,
  categories,
  today,
}: {
  habits: HabitDTO[];
  /** Keyed by habit id; see `HabitProgress`. */
  progress: Record<string, HabitProgress>;
  /** Day-by-day completion across every habit, oldest first. */
  trend: HabitTrendPoint[];
  trendWindow: HabitTrendWindow;
  /** Per habit, the displayed month's days. */
  grid: Record<string, HabitDay[]>;
  month: HabitMonth;
  categories: readonly CategoryDTO[];
  today: string;
}) {
  const router = useRouter();
  const { counts } = useAppData();
  const [, startTransition] = useTransition();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<HabitDTO | null>(null);
  const [deleting, setDeleting] = useState<HabitDTO | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loadingExamples, setLoadingExamples] = useState(false);

  // A paused habit keeps its history but is not tracked: it drops out of the
  // grid and the trend, and its card offers to resume it.
  const tracked = habits.filter((habit) => !habit.paused);

  // Both controls live in the query string, so each href has to carry the other
  // one or switching either would silently reset the other.
  const monthHref = (monthFirst: string) =>
    `/habits?month=${monthParamValue(monthFirst)}&range=${trendWindow}`;
  const rangeHref = (window: HabitTrendWindow) =>
    `/habits?month=${monthParamValue(month.first)}&range=${window}`;
  const thisMonthHref = `/habits?range=${trendWindow}`;

  // Example data can only be loaded into a workspace with nothing in it.
  const workspaceIsEmpty = counts.open === 0 && counts.completed === 0;

  const refresh = () => startTransition(() => router.refresh());

  /** Sample data, so a new workspace can see the tracker with something in it. */
  async function loadExamples() {
    setLoadingExamples(true);
    const result = await loadExampleTasksAction();
    setLoadingExamples(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(
      `Loaded ${result.data?.habits ?? 0} example habits with six weeks of history`,
    );
    refresh();
  }

  /** Creating a category inside the dialog also updates the sidebar. */
  async function handleCreateCategory(name: string): Promise<CategoryDTO | null> {
    const result = await createCategoryAction({ name });
    if (!result.ok || !result.data) {
      toast.error("Couldn't create the category", {
        description: result.ok ? "Please try again." : result.error,
      });
      return null;
    }
    toast.success(`Category “${result.data.name}” created`);
    refresh();
    return result.data;
  }

  async function handleTogglePaused(habit: HabitDTO) {
    setBusyId(habit.id);
    const result = await updateHabitAction({ id: habit.id, paused: !habit.paused });
    setBusyId(null);
    if (!result.ok) {
      toast.error("Couldn't update the habit", { description: result.error });
      return;
    }
    toast.success(habit.paused ? `“${habit.title}” resumed` : `“${habit.title}” paused`);
    refresh();
  }

  async function handleDelete(habit: HabitDTO) {
    setBusyId(habit.id);
    const result = await deleteHabitAction({ id: habit.id });
    setBusyId(null);
    if (!result.ok) {
      toast.error("Couldn't delete the habit", { description: result.error });
      return;
    }
    toast.success(`Deleted “${habit.title}”`);
    refresh();
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-6 sm:px-6 lg:py-10">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-base font-semibold tracking-tight">Habits</h1>
          <p className="max-w-prose text-sm text-muted-foreground">
            Each day a habit is due, Kairos creates the task for you and puts it in{" "}
            <Link href="/today" className="font-medium text-foreground underline">
              Today
            </Link>
            . Ticking it off there is what marks the habit done — or tick it straight
            in the grid below.
          </p>
        </div>
        <Button size="sm" className="h-8" onClick={() => setCreating(true)}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          New habit
        </Button>
      </header>

      {habits.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border px-6 py-12 text-center">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-muted">
            <Repeat className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          </span>
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium">No habits yet</p>
            <p className="max-w-sm text-xs text-muted-foreground">
              A habit is a task that repeats: choose the days it is due on and it will
              be waiting in Today, every time.
            </p>
          </div>
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            New habit
          </Button>
          {workspaceIsEmpty ? (
            <Button
              variant="outline"
              size="sm"
              onClick={loadExamples}
              disabled={loadingExamples}
            >
              <BookOpenCheck className="mr-1.5 h-3.5 w-3.5" />
              {loadingExamples ? "Loading…" : "Load example habits"}
            </Button>
          ) : null}
        </div>
      ) : (
        <>
          {tracked.length > 0 ? (
            <HabitMonthGrid
              habits={tracked}
              grid={grid}
              month={month}
              today={today}
              progress={progress}
              monthHref={monthHref}
              thisMonthHref={thisMonthHref}
            />
          ) : null}

          {tracked.length > 0 ? (
            <HabitTrend
              points={trend}
              habits={tracked}
              trendWindow={trendWindow}
              today={today}
              rangeHref={rangeHref}
            />
          ) : null}

          <h2 className="px-1 pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Your habits
          </h2>

          <ul className="flex flex-col gap-2">
            {habits.map((habit) => (
              <li key={habit.id}>
                <HabitCard
                  habit={habit}
                  progress={progress[habit.id]}
                  categories={categories}
                  busy={busyId === habit.id}
                  onEdit={() => setEditing(habit)}
                  onTogglePaused={() => void handleTogglePaused(habit)}
                onDelete={() => setDeleting(habit)}
              />
            </li>
          ))}
          </ul>
        </>
      )}

      <p className="px-1 text-xs text-muted-foreground">
        Habit tasks stay out of All Tasks and Completed — they are only ever part of
        Today, and of the progress shown here.
      </p>

      <HabitDialog
        open={creating}
        onOpenChange={setCreating}
        categories={categories}
        onCreateCategory={handleCreateCategory}
      />
      <HabitDialog
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        habit={editing ?? undefined}
        categories={categories}
        onCreateCategory={handleCreateCategory}
      />

      <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{deleting?.title}”?</AlertDialogTitle>
            <AlertDialogDescription>
              The habit and the tasks it generated are removed for good. Its history
              disappears from these progress numbers as well.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault();
                if (deleting) void handleDelete(deleting);
                setDeleting(null);
              }}
            >
              Delete habit
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function HabitCard({
  habit,
  progress,
  categories,
  busy,
  onEdit,
  onTogglePaused,
  onDelete,
}: {
  habit: HabitDTO;
  progress: HabitProgress | undefined;
  categories: readonly CategoryDTO[];
  busy: boolean;
  onEdit: () => void;
  onTogglePaused: () => void;
  onDelete: () => void;
}) {
  const category = categories.find((item) => item.id === habit.categoryId) ?? null;
  // A paused habit is not tracked, so its streak and rate are not shown: they
  // would decay for a reason the user did not choose.
  const measured = !habit.paused;
  const streak = measured ? (progress?.streak ?? 0) : 0;
  const rate = progress?.rate ?? 0;

  return (
    <section
      aria-label={habit.title}
      className={cn(
        "flex flex-col gap-3 rounded-lg border border-border bg-card px-3 py-3",
        habit.paused && "opacity-70",
      )}
    >
      <div className="flex items-start gap-2">
        <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-md bg-muted">
          {category ? (
            <CategoryGlyph
              icon={category.icon}
              color={category.color}
              className="h-4 w-4"
            />
          ) : (
            <Repeat className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          )}
        </span>

        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h2 className="min-w-0 truncate text-sm font-medium">{habit.title}</h2>
            {habit.paused ? (
              <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                Paused — not tracked
              </span>
            ) : null}
            {streak > 0 ? (
              <span
                className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-foreground"
                title={`${streak} ${streak === 1 ? "day" : "days"} in a row`}
              >
                <Flame className="h-3 w-3 text-primary" aria-hidden="true" />
                {streak} day streak
              </span>
            ) : null}
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {describeHabitCadence(habit.days)}
            {category ? ` · ${category.name}` : ""}
            {measured ? ` · ${rate}% of the last 30 days` : ""}
            {` · since ${habit.startDate}`}
          </p>
          {habit.notes ? (
            <p className="line-clamp-2 text-xs text-muted-foreground">{habit.notes}</p>
          ) : null}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0 text-muted-foreground"
              aria-label={`Actions for ${habit.title}`}
              disabled={busy}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onSelect={onEdit}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit habit
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onTogglePaused}>
              {habit.paused ? (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Resume
                </>
              ) : (
                <>
                  <Pause className="mr-2 h-4 w-4" />
                  Pause
                </>
              )}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onSelect={onDelete}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete habit
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
        <HabitTodayStatus progress={progress} paused={habit.paused} />
      </div>
    </section>
  );
}

function HabitTodayStatus({
  progress,
  paused,
}: {
  progress: HabitProgress | undefined;
  paused: boolean;
}) {
  if (paused) {
    return (
      <span className="text-xs text-muted-foreground">
        Paused — resume it to start tracking again
      </span>
    );
  }
  if (!progress || !progress.dueToday) {
    return <span className="text-xs text-muted-foreground">Not due today</span>;
  }
  if (progress.doneToday) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium">
        <Check className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
        Done today
      </span>
    );
  }
  return (
    <Link href="/today" className="text-xs text-muted-foreground hover:text-foreground">
      Waiting in Today →
    </Link>
  );
}
