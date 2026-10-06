"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

import { useAppData, usePanelState } from "@/components/app-data";
import { MiniActivityChart } from "@/components/statistics/charts";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { WorkspaceProgress } from "@/lib/stats";
import { cn } from "@/lib/utils";

/**
 * Progress for the current view.
 *
 * Current completion (how much is left) is deliberately separate from the trend
 * chart (what was completed on which day).
 */
export function ProgressPanelContent({
  title,
  progress,
  statisticsHref = "/statistics",
  className,
}: {
  title: string;
  progress: WorkspaceProgress;
  statisticsHref?: string;
  className?: string;
}) {
  const { counts, today } = useAppData();
  const { parents, subtasks } = progress;
  const totalCompleted = counts.completed + counts.open;

  return (
    <div className={cn("flex flex-col gap-5 p-4", className)}>
      <div>
        <h2 className="text-sm font-semibold">Progress</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">{title}</p>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <span className="text-2xl font-semibold tabular-nums">{parents.percentage}%</span>
          <span className="text-xs text-muted-foreground">
            {parents.completed} of {parents.total} tasks
          </span>
        </div>
        <Progress value={parents.percentage} className="h-1.5" />
      </div>

      <dl className="grid grid-cols-2 gap-3">
        <div className="rounded-md border border-border px-3 py-2">
          <dt className="text-xs text-muted-foreground">Completed</dt>
          <dd className="text-lg font-medium tabular-nums">{parents.completed}</dd>
        </div>
        <div className="rounded-md border border-border px-3 py-2">
          <dt className="text-xs text-muted-foreground">Remaining</dt>
          <dd className="text-lg font-medium tabular-nums">{parents.remaining}</dd>
        </div>
      </dl>

      <div className="rounded-md border border-border px-3 py-2">
        <div className="flex items-baseline justify-between">
          <span className="text-xs text-muted-foreground">Subtasks</span>
          <span className="text-xs tabular-nums text-muted-foreground">
            {subtasks.completed}/{subtasks.total}
          </span>
        </div>
        <Progress value={subtasks.percentage} className="mt-2 h-1.5" />
      </div>

      <Separator />

      <div>
        <div className="flex items-baseline justify-between">
          <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Completed per day
          </h3>
          <span className="text-xs text-muted-foreground">last {progress.windowDays} days</span>
        </div>
        <MiniActivityChart points={progress.activity} today={today} />
        <p className="text-xs text-muted-foreground">
          {progress.activity.reduce((total, point) => total + point.completed, 0)} tasks completed
          in this window
        </p>
      </div>

      <Separator />

      <div className="flex flex-col gap-1 text-xs text-muted-foreground">
        <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Overall
        </h3>
        <p>
          {counts.open} open · {counts.completed} completed
          {totalCompleted > 0
            ? ` · ${Math.round((counts.completed / totalCompleted) * 100)}% done`
            : ""}
        </p>
        <p>
          {counts.overdue} overdue · {counts.today} in Today · {counts.unscheduled} unscheduled
        </p>
      </div>

      <Button variant="outline" size="sm" asChild>
        <Link href={statisticsHref}>Open statistics</Link>
      </Button>
    </div>
  );
}

/** Desktop panel: collapsible, never takes focus away from the task list. */
export function ProgressPanel({
  title,
  progress,
  statisticsHref = "/statistics",
}: {
  title: string;
  progress: WorkspaceProgress;
  statisticsHref?: string;
}) {
  const { collapsed, toggle } = usePanelState();

  if (collapsed) {
    return (
      <div className="sticky top-0 hidden h-screen w-10 shrink-0 border-l border-border xl:flex xl:flex-col xl:items-center xl:pt-4">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              aria-label="Show progress panel"
              onClick={toggle}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">Show progress</TooltipContent>
        </Tooltip>
      </div>
    );
  }

  return (
    <aside
      aria-label="Progress"
      className="sticky top-0 hidden h-screen w-72 shrink-0 flex-col border-l border-border xl:flex"
    >
      <div className="flex justify-end px-2 py-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground"
              aria-label="Hide progress panel"
              onClick={toggle}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">Hide progress</TooltipContent>
        </Tooltip>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <ProgressPanelContent title={title} progress={progress} statisticsHref={statisticsHref} />
      </div>
    </aside>
  );
}

/** Mobile: the same content, behind a button in the page header. */
export function ProgressPanelSheet({
  open,
  onOpenChange,
  title,
  progress,
  statisticsHref = "/statistics",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  progress: WorkspaceProgress;
  statisticsHref?: string;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto p-0 sm:max-w-sm">
        <SheetTitle className="sr-only">Progress</SheetTitle>
        <ProgressPanelContent
          title={title}
          progress={progress}
          statisticsHref={statisticsHref}
          className="pt-10"
        />
      </SheetContent>
    </Sheet>
  );
}
