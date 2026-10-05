"use client";

import {
  ArrowDown,
  ArrowUp,
  Check,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";

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
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  CategorySelect,
  DateField,
  LabelSelect,
  PrioritySelect,
} from "@/components/tasks/selects";
import { NOTES_MAX_LENGTH, TITLE_MAX_LENGTH } from "@/lib/constants";
import { formatTimestamp } from "@/lib/dates";
import type { CategoryDTO, LabelDTO, TaskDTO, TaskPriority } from "@/types/kairos";

const TOP_LEVEL = "__top__";

export type TaskDetailsCallbacks = {
  onPatch: (taskId: string, patch: Partial<TaskDTO>) => Promise<{ ok: boolean; error?: string }>;
  onToggleStatus: (task: TaskDTO) => void;
  onDelete: (taskId: string) => void;
  onAddSubtask: (parentId: string, title: string) => void;
  onToggleSubtask: (parentId: string, subtaskId: string, status: "TODO" | "DONE") => void;
  onRenameSubtask: (parentId: string, subtaskId: string, title: string) => void;
  onDeleteSubtask: (parentId: string, subtaskId: string) => void;
  onMoveSubtask: (parentId: string, subtaskId: string, direction: "up" | "down") => void;
  onChangeParent: (taskId: string, parentId: string | null) => void;
};

/**
 * Details panel for the selected task: every field lives here, including the
 * keyboard-friendly alternatives to dragging (category, dates, parent, order).
 */
export function TaskDetailsPanel({
  task,
  open,
  onOpenChange,
  categories,
  labels,
  parentOptions,
  timeZone,
  ...callbacks
}: {
  task: TaskDTO | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: readonly CategoryDTO[];
  labels: readonly LabelDTO[];
  parentOptions: readonly { id: string; title: string }[];
  timeZone: string;
} & TaskDetailsCallbacks) {
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [addingSubtask, setAddingSubtask] = useState(false);
  const [subtaskDraft, setSubtaskDraft] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    setTitle(task?.title ?? "");
    setNotes(task?.notes ?? "");
    setAddingSubtask(false);
    setSubtaskDraft("");
  }, [task?.id, task?.title, task?.notes, open]);

  if (!task) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Task details</SheetTitle>
            <SheetDescription>Select a task to see and edit its details.</SheetDescription>
          </SheetHeader>
        </SheetContent>
      </Sheet>
    );
  }

  const isSubtask = task.parentId !== null;
  const done = task.status === "DONE";
  const doneSubtasks = task.subtasks.filter((subtask) => subtask.status === "DONE").length;

  function commitTitle() {
    const next = title.trim();
    if (!next || !task || next === task.title) {
      setTitle(task?.title ?? "");
      return;
    }
    void callbacks.onPatch(task.id, { title: next });
  }

  function commitNotes() {
    if (!task) return;
    const next = notes.trim() === "" ? null : notes.trim();
    if (next === task.notes) return;
    void callbacks.onPatch(task.id, { notes: next });
  }

  async function submitSubtask() {
    const value = subtaskDraft.trim();
    if (!value || !task) return;
    setSubtaskDraft("");
    setAddingSubtask(false);
    callbacks.onAddSubtask(task.id, value);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-md">
        <SheetHeader className="border-b border-border px-5 py-4">
          <SheetTitle className="text-sm font-medium text-muted-foreground">
            Task details
          </SheetTitle>
          <SheetDescription className="sr-only">
            Edit the title, notes, category, labels, priority and dates of this task.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-5 px-5 py-4">
          <div className="flex items-start gap-3">
            <Checkbox
              checked={done}
              aria-label={done ? "Reopen task" : "Complete task"}
              onCheckedChange={() => callbacks.onToggleStatus(task)}
              className="mt-2 h-4 w-4"
            />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <Label htmlFor="details-title" className="sr-only">
                Title
              </Label>
              <Input
                id="details-title"
                value={title}
                maxLength={TITLE_MAX_LENGTH}
                onChange={(event) => setTitle(event.target.value)}
                onBlur={commitTitle}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    (event.target as HTMLInputElement).blur();
                  }
                }}
                className="h-9 text-sm font-medium"
              />
              <p className="text-xs text-muted-foreground">
                {done ? "Completed" : "Open"}
                {task.completedAt
                  ? ` · ${formatTimestamp(task.completedAt, timeZone, {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}`
                  : ""}
                {isSubtask ? " · Subtask" : ""}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="details-notes">Notes</Label>
            <Textarea
              id="details-notes"
              value={notes}
              maxLength={NOTES_MAX_LENGTH}
              placeholder="Add context, links, or a checklist…"
              onChange={(event) => setNotes(event.target.value)}
              onBlur={commitNotes}
              className="min-h-24 text-sm"
            />
          </div>

          <Separator />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="details-priority">Priority</Label>
              <PrioritySelect
                id="details-priority"
                value={task.priority}
                onChange={(priority: TaskPriority) => void callbacks.onPatch(task.id, { priority })}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="details-category">Category</Label>
              <CategorySelect
                id="details-category"
                value={task.categoryId}
                categories={categories}
                disabled={isSubtask}
                disabledHint="Subtasks inherit their parent's category."
                onChange={(categoryId) => void callbacks.onPatch(task.id, { categoryId })}
              />
              {isSubtask ? (
                <p className="text-xs text-muted-foreground">Inherited from the parent task.</p>
              ) : null}
            </div>

            <DateField
              id="details-scheduled"
              label="Planned date"
              value={task.scheduledDate}
              hint="When you plan to work on it."
              onChange={(scheduledDate) => void callbacks.onPatch(task.id, { scheduledDate })}
            />

            <DateField
              id="details-due"
              label="Due date"
              value={task.dueDate}
              hint="The deadline."
              onChange={(dueDate) => void callbacks.onPatch(task.id, { dueDate })}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="details-labels">Labels</Label>
            <LabelSelect
              id="details-labels"
              value={task.labels.map((label) => label.id)}
              labels={labels}
              onChange={(labelIds) =>
                void callbacks.onPatch(task.id, {
                  labels: labelIds
                    .map((id) => labels.find((label) => label.id === id))
                    .filter((label): label is LabelDTO => Boolean(label)),
                })
              }
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="details-parent">Nesting</Label>
            <Select
              value={task.parentId ?? TOP_LEVEL}
              onValueChange={(value) =>
                callbacks.onChangeParent(task.id, value === TOP_LEVEL ? null : value)
              }
            >
              <SelectTrigger id="details-parent">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TOP_LEVEL}>Top-level task</SelectItem>
                {parentOptions.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    Subtask of “{option.title}”
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div>
                <Label>Subtasks</Label>
                <p className="text-xs text-muted-foreground">
                  {task.subtasks.length === 0
                    ? "Break this task into smaller steps."
                    : `${doneSubtasks} of ${task.subtasks.length} done`}
                </p>
              </div>
              {!isSubtask ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8"
                  onClick={() => setAddingSubtask(true)}
                >
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  Add
                </Button>
              ) : null}
            </div>

            {isSubtask ? (
              <p className="text-xs text-muted-foreground">
                Subtasks cannot contain other subtasks.
              </p>
            ) : (
              <ul className="flex flex-col gap-1">
                {task.subtasks.map((subtask) => (
                  <li
                    key={subtask.id}
                    className="flex items-center gap-2 rounded-md border border-border px-2 py-1.5"
                  >
                    <Checkbox
                      checked={subtask.status === "DONE"}
                      aria-label={
                        subtask.status === "DONE"
                          ? `Reopen ${subtask.title}`
                          : `Complete ${subtask.title}`
                      }
                      onCheckedChange={(checked) =>
                        callbacks.onToggleSubtask(
                          task.id,
                          subtask.id,
                          checked ? "DONE" : "TODO",
                        )
                      }
                      className="h-3.5 w-3.5"
                    />
                    <input
                      defaultValue={subtask.title}
                      aria-label={`Subtask title ${subtask.title}`}
                      className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                      onBlur={(event) => {
                        const next = event.target.value.trim();
                        if (next && next !== subtask.title) {
                          callbacks.onRenameSubtask(task.id, subtask.id, next);
                        } else {
                          event.target.value = subtask.title;
                        }
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          (event.target as HTMLInputElement).blur();
                        }
                      }}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      aria-label={`Move ${subtask.title} up`}
                      onClick={() => callbacks.onMoveSubtask(task.id, subtask.id, "up")}
                    >
                      <ArrowUp className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      aria-label={`Move ${subtask.title} down`}
                      onClick={() => callbacks.onMoveSubtask(task.id, subtask.id, "down")}
                    >
                      <ArrowDown className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-destructive"
                      aria-label={`Delete subtask ${subtask.title}`}
                      onClick={() => callbacks.onDeleteSubtask(task.id, subtask.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}

            {addingSubtask && !isSubtask ? (
              <div className="flex items-center gap-2">
                <Input
                  autoFocus
                  value={subtaskDraft}
                  aria-label="New subtask title"
                  placeholder="Subtask title"
                  className="h-8 text-sm"
                  onChange={(event) => setSubtaskDraft(event.target.value)}
                  onBlur={() => void submitSubtask()}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void submitSubtask();
                    }
                    if (event.key === "Escape") {
                      setSubtaskDraft("");
                      setAddingSubtask(false);
                    }
                  }}
                />
              </div>
            ) : null}
          </div>

          <Separator />

          <div className="flex flex-col gap-2 pb-4">
            <Button
              variant="outline"
              onClick={() => callbacks.onToggleStatus(task)}
              className="justify-start"
            >
              {done ? (
                <>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Reopen task
                </>
              ) : (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Complete task
                </>
              )}
            </Button>
            <Button
              variant="ghost"
              className="justify-start text-destructive hover:text-destructive"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete task
            </Button>
            <p className="text-xs text-muted-foreground">
              Created {formatTimestamp(task.createdAt, timeZone)}
              {task.subtasks.length > 0
                ? ` · Deleting this task also deletes ${task.subtasks.length} subtask${
                    task.subtasks.length === 1 ? "" : "s"
                  }.`
                : ""}
            </p>
          </div>
        </div>
      </SheetContent>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{task.title}”?</AlertDialogTitle>
            <AlertDialogDescription>
              {task.subtasks.length > 0
                ? `This also deletes ${task.subtasks.length} subtask${
                    task.subtasks.length === 1 ? "" : "s"
                  }. `
                : ""}
              You can undo this straight after with the toast that appears.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault();
                setConfirmDelete(false);
                onOpenChange(false);
                callbacks.onDelete(task.id);
              }}
            >
              Delete task
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  );
}
