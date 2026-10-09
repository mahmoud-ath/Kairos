"use client";

import type { DragEndEvent } from "@dnd-kit/core";
import { ChartNoAxesColumn, PanelRightClose, PanelRightOpen } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useOptimistic,
  useRef,
  useState,
  useTransition,
} from "react";
import { toast } from "sonner";

import { useAppData, usePanelState } from "@/components/app-data";
import { useDragRegistry, useDragState } from "@/components/dnd/drag-provider";
import { ProgressPanel, ProgressPanelSheet } from "@/components/layout/progress-panel";
import { EmptyState } from "@/components/tasks/empty-state";
import {
  CATEGORY_PREFIX,
  findDragItem,
  NEST_DELTA,
  nestParentIdFor,
  reorderedIdsFor,
  scheduledDateForSection,
  sectionByKey,
  sectionOf,
  SECTION_PREFIX,
  SUBTASK_LIST_PREFIX,
  UNNEST_DELTA,
  type DragIntent,
} from "@/components/tasks/dnd-utils";
import { clientTaskId, optimisticReducer, type OptimisticAction } from "@/components/tasks/optimistic";
import { QuickAdd, type QuickAddValues } from "@/components/tasks/quick-add";
import { TaskDetailsPanel } from "@/components/tasks/task-details";
import { TaskSectionView } from "@/components/tasks/task-section";
import { TaskToolbar } from "@/components/tasks/task-toolbar";
import { Button } from "@/components/ui/button";
import { applyFilters, DEFAULT_FILTERS } from "@/lib/filters";
import type { WorkspaceProgress } from "@/lib/stats";
import {
  buildSections,
  defaultCategoryId,
  defaultScheduledDate,
  selectScopedTasks,
  type ViewScope,
} from "@/lib/views";
import type {
  ActionResult,
  CategoryDTO,
  SubtaskDTO,
  TaskDTO,
  TaskFilters,
} from "@/types/kairos";
import {
  clearCompletedAction,
  createTaskAction,
  deleteTaskAction,
  moveTaskAction,
  reorderTaskAction,
  setTaskStatusAction,
  undoDeleteTaskAction,
  updateTaskAction,
} from "@/server/actions/tasks";
import { createCategoryAction } from "@/server/actions/taxonomy";

export type TaskWorkspaceProps = {
  scope: ViewScope;
  title: string;
  /** Every top-level task; the workspace narrows it to the current view. */
  tasks: TaskDTO[];
  progress: WorkspaceProgress;
  emptyTitle: string;
  emptyDescription: string;
  /** Shows the category chip on each row (All Tasks / Completed). */
  showCategory: boolean;
  statisticsHref?: string;
};

export function TaskWorkspace({
  scope,
  title,
  tasks,
  progress,
  emptyTitle,
  emptyDescription,
  showCategory,
  statisticsHref,
}: TaskWorkspaceProps) {
  const { categories, today, counts, settings } = useAppData();
  const { handlers } = useDragRegistry();
  const dragState = useDragState();
  const panel = usePanelState();

  const [filters, setFilters] = useState<TaskFilters>(DEFAULT_FILTERS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [focusTarget, setFocusTarget] = useState<"notes" | null>(null);
  const [progressOpen, setProgressOpen] = useState(false);
  const [optimisticTasks, applyOptimistic] = useOptimistic(tasks, optimisticReducer);
  const [, startTransition] = useTransition();

  // Completed tasks are always part of the list (in their own section); the view
  // itself is what decides which tasks exist here.
  const includeCompleted = true;

  const scopedTasks = useMemo(
    () => selectScopedTasks(scope, optimisticTasks, today),
    [scope, optimisticTasks, today],
  );
  const visibleTasks = useMemo(
    () => applyFilters(scopedTasks, filters),
    [scopedTasks, filters],
  );
  const sections = useMemo(
    () =>
      buildSections({ scope, tasks: visibleTasks, today, includeCompleted }).filter(
        (section) =>
          section.tasks.length > 0 ||
          (section.kind === "today" && scope.kind !== "completed") ||
          section.kind === "unscheduled",
      ),
    [scope, visibleTasks, today, includeCompleted],
  );

  const categoryNames = useMemo(
    () => new Map(categories.map((category) => [category.id, category.name])),
    [categories],
  );

  const selectedTask = useMemo(
    () => optimisticTasks.find((task) => task.id === selectedId) ?? null,
    [optimisticTasks, selectedId],
  );

  const visibleCount = sections.reduce((total, section) => total + section.tasks.length, 0);
  const completedInScope = scopedTasks.filter((task) => task.status === "DONE").length;
  // "Clear completed" works on a whole category or on everything, so the
  // confirmation must show the number it will really delete.
  const clearCompletedScope: "all" | "category" =
    scope.kind === "category" ? "category" : "all";
  const clearCompletedCount =
    clearCompletedScope === "category" ? completedInScope : counts.completed;
  const workspaceIsEmpty = counts.open === 0 && counts.completed === 0;

  const nestTargetId = dragState.intent === "nest" ? dragState.overId : null;

  const router = useRouter();
  const quickAddRef = useRef<HTMLDivElement>(null);

  /* ---------------------------------------------------------------------- */
  /* Mutations                                                              */
  /* ---------------------------------------------------------------------- */

  /**
   * Apply the change locally first, then persist it. `useOptimistic` throws the
   * local change away when the action settles, so a failure rolls back on its
   * own — we only have to explain what happened.
   */
  const mutate = useCallback(
    (action: OptimisticAction, request: () => Promise<ActionResult<unknown>>) => {
      startTransition(async () => {
        applyOptimistic(action);
        const result = await request();
        if (!result.ok) {
          toast.error("Couldn't save your change", {
            description: `${result.error} The list was restored.`,
          });
        }
      });
    },
    [applyOptimistic],
  );

  function handleToggle(task: TaskDTO) {
    const next = task.status === "DONE" ? "TODO" : "DONE";
    const completedAt = next === "DONE" ? new Date().toISOString() : null;
    const patch: Partial<TaskDTO> = { status: next, completedAt };
    if (next === "DONE") {
      // Completing a parent completes its unfinished subtasks (server enforces
      // this too); reopening never touches them.
      patch.subtasks = task.subtasks.map((subtask) =>
        subtask.status === "DONE" ? subtask : { ...subtask, status: "DONE", completedAt },
      );
    }
    mutate({ type: "patch", id: task.id, patch }, () =>
      setTaskStatusAction({ id: task.id, status: next }),
    );
  }

  function handleToggleSubtask(parentId: string, subtaskId: string, status: "TODO" | "DONE") {
    mutate(
      {
        type: "patchSubtask",
        parentId,
        subtaskId,
        patch: {
          status,
          completedAt: status === "DONE" ? new Date().toISOString() : null,
        },
      },
      () => setTaskStatusAction({ id: subtaskId, status }),
    );
  }

  function handlePatchTask(taskId: string, patch: Partial<TaskDTO>) {
    const input: Record<string, unknown> = { id: taskId };
    if (patch.title !== undefined) input.title = patch.title;
    if (patch.notes !== undefined) input.notes = patch.notes;
    if (patch.categoryId !== undefined) input.categoryId = patch.categoryId;
    if (patch.scheduledDate !== undefined) input.scheduledDate = patch.scheduledDate;
    if (patch.dueDate !== undefined) input.dueDate = patch.dueDate;
    if (patch.status !== undefined) input.status = patch.status;

    mutate({ type: "patch", id: taskId, patch }, () => updateTaskAction(input));
  }

  function handleMoveToCategory(taskId: string, categoryId: string | null) {
    mutate({ type: "patch", id: taskId, patch: { categoryId } }, () =>
      moveTaskAction({ id: taskId, categoryId }),
    );
  }

  function handleSchedule(taskId: string, scheduledDate: string | null) {
    mutate({ type: "patch", id: taskId, patch: { scheduledDate } }, () =>
      updateTaskAction({ id: taskId, scheduledDate }),
    );
  }

  function handleChangeParent(taskId: string, parentId: string | null) {
    mutate({ type: "patch", id: taskId, patch: { parentId } }, () =>
      moveTaskAction({ id: taskId, parentId }),
    );
  }

  /** Quick creation from any category picker. */
  async function handleCreateCategory(name: string): Promise<CategoryDTO | null> {
    const result = await createCategoryAction({ name });
    if (!result.ok || !result.data) {
      toast.error("Couldn't create the category", {
        description: result.ok ? "Please try again." : result.error,
      });
      return null;
    }
    toast.success(`Category “${result.data.name}” created`);
    // The sidebar lists categories from the app layout — refresh it as well.
    startTransition(() => router.refresh());
    return result.data;
  }

  function handleAddSubtask(parentId: string, title: string) {
    const parent = optimisticTasks.find((task) => task.id === parentId);
    const subtask: SubtaskDTO = {
      id: clientTaskId(),
      title,
      status: "TODO",
      position: parent?.subtasks.length ?? 0,
      completedAt: null,
    };
    mutate({ type: "addSubtask", parentId, subtask }, () =>
      createTaskAction({ id: subtask.id, title, parentId }),
    );
  }

  function handleRenameSubtask(parentId: string, subtaskId: string, title: string) {
    mutate({ type: "patchSubtask", parentId, subtaskId, patch: { title } }, () =>
      updateTaskAction({ id: subtaskId, title }),
    );
  }

  function handleDeleteSubtask(parentId: string, subtaskId: string) {
    mutate({ type: "removeSubtask", parentId, subtaskId }, () =>
      deleteTaskAction({ id: subtaskId }),
    );
  }

  function handleMoveSubtask(parentId: string, subtaskId: string, direction: "up" | "down") {
    const parent = optimisticTasks.find((task) => task.id === parentId);
    if (!parent) return;
    const index = parent.subtasks.findIndex((subtask) => subtask.id === subtaskId);
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (index < 0 || targetIndex < 0 || targetIndex >= parent.subtasks.length) return;

    mutate(
      {
        type: "reorderSubtasks",
        parentId,
        orderedIds: reorderIdsInList(
          parent.subtasks.map((subtask) => subtask.id),
          subtaskId,
          targetIndex,
        ),
      },
      () => reorderTaskAction({ id: subtaskId, parentId, targetIndex }),
    );
  }

  function handleMove(taskId: string, direction: "up" | "down") {
    const section = sectionOf(sections, taskId);
    if (!section) return;
    const index = section.tasks.findIndex((task) => task.id === taskId);
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (index < 0 || targetIndex < 0 || targetIndex >= section.tasks.length) return;

    mutate(
      {
        type: "reorder",
        movedId: taskId,
        orderedIds: reorderedIdsFor(section, taskId, targetIndex),
      },
      () => reorderTaskAction({ id: taskId, parentId: null, targetIndex }),
    );
  }

  /** Turn a task into a subtask of `parentId`. */
  function handleNest(taskId: string, parentId: string) {
    const child = optimisticTasks.find((task) => task.id === taskId);
    const parent = optimisticTasks.find((task) => task.id === parentId);
    if (!child || !parent) return;

    const subtask: SubtaskDTO = {
      id: child.id,
      title: child.title,
      status: child.status,
      position: parent.subtasks.length,
      completedAt: child.completedAt,
    };
    mutate({ type: "nest", parentId, subtask }, () =>
      moveTaskAction({ id: taskId, parentId }),
    );
    toast.success(`“${child.title}” is now a subtask of “${parent.title}”`);
  }

  /** Pull a subtask back out to the top level. */
  function handleUnnest(parentId: string, subtaskId: string, scheduledDate?: string | null) {
    const parent = optimisticTasks.find((task) => task.id === parentId);
    const subtask = parent?.subtasks.find((candidate) => candidate.id === subtaskId);
    if (!parent || !subtask) return;

    const now = new Date().toISOString();
    const promoted: TaskDTO = {
      id: subtask.id,
      title: subtask.title,
      notes: null,
      status: subtask.status,
      categoryId: parent.categoryId,
      parentId: null,
      scheduledDate: scheduledDate !== undefined ? scheduledDate : parent.scheduledDate,
      dueDate: null,
      position: nextPositionFor(optimisticTasks),
      createdAt: now,
      updatedAt: now,
      completedAt: subtask.completedAt,
      subtasks: [],
    };
    const date =
      scheduledDate !== undefined ? scheduledDate : parent.scheduledDate;

    mutate({ type: "unnest", parentId, task: promoted }, () =>
      moveTaskAction({ id: subtaskId, parentId: null, scheduledDate: date }),
    );
  }

  function handleDelete(taskId: string) {
    startTransition(async () => {
      applyOptimistic({ type: "remove", id: taskId });
      const result = await deleteTaskAction({ id: taskId });
      if (!result.ok) {
        toast.error("Couldn't delete the task", {
          description: `${result.error} The task was restored.`,
        });
        return;
      }
      const snapshot = result.data;
      if (!snapshot) return;
      setDetailsOpen(false);
      toast.success(`Deleted “${snapshot.title}”`, {
        duration: 8000,
        action: {
          label: "Undo",
          onClick: () => {
            void restoreSnapshot(snapshot);
          },
        },
      });
    });

    if (selectedId === taskId) setSelectedId(null);
  }

  async function restoreSnapshot(snapshot: TaskDTO) {
    const result = await undoDeleteTaskAction({
      id: snapshot.id,
      title: snapshot.title,
      notes: snapshot.notes,
      status: snapshot.status,
      categoryId: snapshot.categoryId,
      scheduledDate: snapshot.scheduledDate,
      dueDate: snapshot.dueDate,
      position: snapshot.position,
      subtasks: snapshot.subtasks.map((subtask) => ({
        id: subtask.id,
        title: subtask.title,
        status: subtask.status,
        position: subtask.position,
      })),
    });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Task restored");
  }

  async function handleClearCompleted() {
    const input =
      scope.kind === "category"
        ? { scope: { kind: "category" as const, categoryId: scope.categoryId } }
        : { scope: { kind: "all" as const } };

    const result = await clearCompletedAction(input);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(
      `Deleted ${result.data?.count ?? 0} completed task${result.data?.count === 1 ? "" : "s"}`,
    );
  }

  async function handleQuickAdd(values: QuickAddValues) {
    const optimisticTask: TaskDTO = {
      id: clientTaskId(),
      title: values.title,
      notes: null,
      status: "TODO",
      categoryId: values.categoryId,
      parentId: null,
      scheduledDate: values.scheduledDate,
      dueDate: null,
      position: nextPositionFor(optimisticTasks),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      completedAt: null,
      subtasks: [],
    };

    return new Promise<ActionResult<TaskDTO>>((resolve) => {
      startTransition(async () => {
        applyOptimistic({ type: "add", task: optimisticTask });
        const result = await createTaskAction({
          id: optimisticTask.id,
          title: values.title,
          categoryId: values.categoryId,
          scheduledDate: values.scheduledDate,
        });
        if (!result.ok) {
          toast.error("Couldn't add the task", { description: result.error });
        }
        resolve(result);
      });
    });
  }

  /* ---------------------------------------------------------------------- */
  /* Drag and drop                                                          */
  /* ---------------------------------------------------------------------- */

  /** What a drop would mean right now — used for highlighting and hints. */
  useEffect(() => {
    handlers.current.resolveIntent = (
      activeId: string,
      overId: string,
      deltaX: number,
    ): DragIntent => {
      const active = findDragItem(optimisticTasks, activeId);
      if (!active) return "invalid";

      if (overId.startsWith(CATEGORY_PREFIX)) {
        return active.parentId ? "invalid" : "category";
      }

      const over = findDragItem(optimisticTasks, overId);

      if (active.parentId) {
        // Subtasks stay in their parent unless they are clearly pulled out.
        if (over?.parentId === active.parentId) return "reorder";
        if (overId === `${SUBTASK_LIST_PREFIX}${active.parentId}`) return "reorder";
        if (!over && overId.startsWith(SECTION_PREFIX)) return "unnest";
        if (over && over.parentId === null && deltaX <= UNNEST_DELTA) return "unnest";
        return "invalid";
      }

      if (over && over.task.id !== activeId) {
        if (deltaX >= NEST_DELTA) return "nest";
        return over.parentId ? "invalid" : "reorder";
      }

      return overId.startsWith(SECTION_PREFIX) ? "reorder" : "invalid";
    };

    handlers.current.renderOverlay = (id: string, intent: DragIntent | null) => {
      const item = findDragItem(optimisticTasks, id);
      if (!item) return null;
      const hint =
        intent === "nest"
          ? "→ make subtask"
          : intent === "unnest"
            ? "← move to top level"
            : intent === "category"
              ? "→ move to category"
              : intent === "invalid" && item.parentId
                ? "← drag left to un-nest"
                : null;
      return (
        <div className="flex max-w-80 items-center gap-2 truncate rounded-md border border-border bg-card px-2.5 py-1.5 text-sm shadow-sm">
          <span className="truncate">{item.task.title}</span>
          {hint ? <span className="shrink-0 text-xs font-medium text-primary">{hint}</span> : null}
        </div>
      );
    };

    handlers.current.onDragEnd = (event: DragEndEvent) => {
      handleDragEnd(event);
    };
  });

  function handleDragEnd(event: DragEndEvent) {
    const { active, over, delta } = event;
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    if (activeId === overId) return;

    const activeItem = findDragItem(optimisticTasks, activeId);
    if (!activeItem) return;
    const overItem = findDragItem(optimisticTasks, overId);
    const intent: DragIntent =
      handlers.current.resolveIntent?.(activeId, overId, delta.x) ?? "invalid";

    // 1. Dropped on a category in the sidebar.
    if (intent === "category") {
      const categoryId = overId.slice(CATEGORY_PREFIX.length) || null;
      if (categoryId === activeItem.task.categoryId) return;
      handleMoveToCategory(activeId, categoryId);
      return;
    }

    // 2. Dropped onto another task, offset to the right: nest it.
    if (intent === "nest" && overItem) {
      const parentId = nestParentIdFor(activeId, overItem);
      if (!parentId) return;
      handleNest(activeId, parentId);
      return;
    }

    // 3. A subtask dragged to the left: pull it out to the top level.
    if (intent === "unnest" && activeItem.parentId) {
      const targetSection = overItem
        ? sectionOf(sections, overId)
        : overId.startsWith(SECTION_PREFIX)
          ? sectionByKey(sections, overId.slice(SECTION_PREFIX.length))
          : null;
      const scheduledDate = targetSection
        ? scheduledDateForSection(targetSection)
        : undefined;
      handleUnnest(activeItem.parentId, activeId, scheduledDate);
      return;
    }

    // 4. Subtasks can only be reordered inside their own parent.
    if (activeItem.parentId) {
      const targetParentId = overItem?.parentId
        ? overItem.parentId
        : overId.startsWith(SUBTASK_LIST_PREFIX)
          ? overId.slice(SUBTASK_LIST_PREFIX.length)
          : null;
      if (!targetParentId || targetParentId !== activeItem.parentId) return;

      const parent = optimisticTasks.find((task) => task.id === targetParentId);
      if (!parent) return;
      const ids = parent.subtasks.map((subtask) => subtask.id);
      const targetIndex = overItem ? ids.indexOf(overId) : ids.length;
      if (targetIndex < 0) return;

      const orderedIds = reorderIdsInList(ids, activeId, targetIndex);
      if (orderedIds.join() === ids.join()) return;

      mutate({ type: "reorderSubtasks", parentId: targetParentId, orderedIds }, () =>
        reorderTaskAction({ id: activeId, parentId: targetParentId, targetIndex }),
      );
      return;
    }

    // 5. Top-level tasks: reorder, or move to another date group.
    const sourceSection = sectionOf(sections, activeId);
    const targetSection = overItem
      ? sectionOf(sections, overId)
      : overId.startsWith(SECTION_PREFIX)
        ? sectionByKey(sections, overId.slice(SECTION_PREFIX.length))
        : null;
    if (!targetSection || targetSection.kind === "completed") return;
    if (overItem?.parentId) return;

    const targetIds = targetSection.tasks.map((task) => task.id);
    const targetIndex = overItem ? targetIds.indexOf(overId) : targetIds.length;
    if (targetIndex < 0) return;

    const scheduledDate = scheduledDateForSection(targetSection);
    const orderedIds = reorderedIdsFor(targetSection, activeId, targetIndex);
    if (orderedIds.join() === targetIds.join() && scheduledDate === undefined) return;
    if (sourceSection?.key === targetSection.key && sourceSection.tasks.length === 0) return;

    mutate({ type: "reorder", movedId: activeId, orderedIds, scheduledDate }, () =>
      reorderTaskAction({
        id: activeId,
        parentId: null,
        scheduledDate,
        targetIndex,
      }),
    );
  }

  /* ---------------------------------------------------------------------- */
  /* Render                                                                 */
  /* ---------------------------------------------------------------------- */

  function openDetails(taskId: string, focus: "notes" | null = null) {
    setSelectedId(taskId);
    setFocusTarget(focus);
    setDetailsOpen(true);
  }

  const rowCallbacks = {
    onOpen: (taskId: string) => openDetails(taskId),
    onOpenNotes: (taskId: string) => openDetails(taskId, "notes"),
    onToggle: handleToggle,
    onRename: (taskId: string, title: string) => handlePatchTask(taskId, { title }),
    onDelete: handleDelete,
    onMove: handleMove,
    onSchedule: handleSchedule,
    onMoveToCategory: handleMoveToCategory,
    onAddSubtask: handleAddSubtask,
    onToggleSubtask: handleToggleSubtask,
    onRenameSubtask: handleRenameSubtask,
    onDeleteSubtask: handleDeleteSubtask,
    onMoveSubtask: handleMoveSubtask,
    onUnnest: (parentId: string, subtaskId: string) => handleUnnest(parentId, subtaskId),
  };

  // Nesting is limited to one level, so only top-level tasks can be parents.
  const parentOptions = optimisticTasks
    .filter((task) => task.id !== selectedTask?.id)
    .map((task) => ({ id: task.id, title: task.title }));

  return (
    <div className="flex min-h-full min-w-0 flex-1 items-stretch">
      <div className="min-w-0 flex-1 px-4 py-5 sm:px-6">
        <header className="flex items-center justify-between gap-3">
          <h1 className="truncate text-base font-semibold tracking-tight">{title}</h1>

          <div className="flex shrink-0 items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-8 xl:hidden"
              onClick={() => setProgressOpen(true)}
            >
              <ChartNoAxesColumn className="mr-1.5 h-3.5 w-3.5" />
              Progress
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="hidden h-8 w-8 text-muted-foreground xl:inline-flex"
              aria-label={panel.collapsed ? "Show progress panel" : "Hide progress panel"}
              onClick={panel.toggle}
            >
              {panel.collapsed ? (
                <PanelRightOpen className="h-4 w-4" />
              ) : (
                <PanelRightClose className="h-4 w-4" />
              )}
            </Button>
          </div>
        </header>

        <div className="mt-4 flex flex-col gap-3" ref={quickAddRef}>
          <QuickAdd
            categories={categories}
            defaultCategoryId={defaultCategoryId(scope)}
            defaultScheduledDate={defaultScheduledDate(scope, today)}
            onSubmit={handleQuickAdd}
            onCreateCategory={handleCreateCategory}
          />

          <TaskToolbar
            filters={filters}
            onFiltersChange={setFilters}
            resultCount={visibleCount}
            totalCount={scopedTasks.length}
            completedCount={completedInScope}
            clearCompletedCount={clearCompletedCount}
            clearCompletedScope={clearCompletedScope}
            onClearCompleted={handleClearCompleted}
          />
        </div>

        <div className="mt-2 flex flex-col">
          {sections.map((section) => (
            <TaskSectionView
              key={section.key}
              section={section}
              today={today}
              selectedId={selectedId}
              categories={categories}
              categoryNames={categoryNames}
              showCategory={showCategory}
              sortable={section.kind !== "completed"}
              nestTargetId={nestTargetId}
              {...rowCallbacks}
            />
          ))}

          {visibleTasks.length === 0 ? (
            <div className="mt-6">
              <EmptyState
                title={emptyTitle}
                description={emptyDescription}
                workspaceIsEmpty={workspaceIsEmpty}
                onFocusQuickAdd={() => quickAddRef.current?.querySelector("input")?.focus()}
              />
            </div>
          ) : null}
        </div>
      </div>

      <ProgressPanel title={title} progress={progress} statisticsHref={statisticsHref} />

      <ProgressPanelSheet
        open={progressOpen}
        onOpenChange={setProgressOpen}
        title={title}
        progress={progress}
        statisticsHref={statisticsHref}
      />

      <TaskDetailsPanel
        task={selectedTask}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        categories={categories}
        parentOptions={parentOptions}
        timeZone={settings.timezone}
        focusTarget={focusTarget}
        onCreateCategory={handleCreateCategory}
        onPatch={(taskId, patch) => {
          handlePatchTask(taskId, patch);
          return Promise.resolve({ ok: true });
        }}
        onToggleStatus={handleToggle}
        onDelete={handleDelete}
        onAddSubtask={handleAddSubtask}
        onToggleSubtask={handleToggleSubtask}
        onRenameSubtask={handleRenameSubtask}
        onDeleteSubtask={handleDeleteSubtask}
        onMoveSubtask={handleMoveSubtask}
        onUnnest={handleUnnest}
        onChangeParent={handleChangeParent}
      />
    </div>
  );
}

export function reorderIdsInList(
  ids: readonly string[],
  movedId: string,
  targetIndex: number,
): string[] {
  const without = ids.filter((id) => id !== movedId);
  const index = Math.max(0, Math.min(targetIndex, without.length));
  without.splice(index, 0, movedId);
  return without;
}

function nextPositionFor(tasks: readonly TaskDTO[]): number {
  return tasks.reduce((max, task) => Math.max(max, task.position), 0) + 1;
}
