"use client";

import { useDroppable } from "@dnd-kit/core";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowDown,
  ArrowUp,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  CornerDownRight,
  GripVertical,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { DateChip, NotesButton, SubtaskProgressLabel } from "@/components/tasks/task-bits";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { addDays } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { CategoryDTO, TaskDTO } from "@/types/kairos";

export type RowCallbacks = {
  onOpen: (taskId: string) => void;
  onOpenNotes: (taskId: string) => void;
  onToggle: (task: TaskDTO) => void;
  onRename: (taskId: string, title: string) => void;
  onDelete: (taskId: string) => void;
  onMove: (taskId: string, direction: "up" | "down") => void;
  onSchedule: (taskId: string, scheduledDate: string | null) => void;
  onMoveToCategory: (taskId: string, categoryId: string | null) => void;
  onAddSubtask: (parentId: string, title: string) => void;
  onToggleSubtask: (parentId: string, subtaskId: string, nextStatus: "TODO" | "DONE") => void;
  onRenameSubtask: (parentId: string, subtaskId: string, title: string) => void;
  onDeleteSubtask: (parentId: string, subtaskId: string) => void;
  onMoveSubtask: (parentId: string, subtaskId: string, direction: "up" | "down") => void;
  /** Pull a subtask back out to the top level (keyboard-friendly alternative). */
  onUnnest: (parentId: string, subtaskId: string) => void;
};

type TaskRowProps = RowCallbacks & {
  task: TaskDTO;
  today: string;
  selected: boolean;
  categories: readonly CategoryDTO[];
  categoryName?: string | null;
  /** Highlighted because a drag would nest the dragged task under this one. */
  nestTarget?: boolean;
};

function InlineTitleEditor({
  value,
  onCommit,
  onCancel,
  ariaLabel,
  className,
}: {
  value: string;
  onCommit: (next: string) => void;
  onCancel: () => void;
  ariaLabel: string;
  className?: string;
}) {
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  function commit() {
    const next = draft.trim();
    if (!next || next === value) {
      onCancel();
      return;
    }
    onCommit(next);
  }

  return (
    <Input
      ref={inputRef}
      value={draft}
      aria-label={ariaLabel}
      onChange={(event) => setDraft(event.target.value)}
      onClick={(event) => event.stopPropagation()}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          commit();
        }
        if (event.key === "Escape") {
          event.preventDefault();
          onCancel();
        }
      }}
      className={cn("h-7 text-sm", className)}
    />
  );
}

function SubtaskRow({
  parentId,
  subtask,
  callbacks,
}: {
  parentId: string;
  subtask: TaskDTO["subtasks"][number];
  callbacks: RowCallbacks;
}) {
  const [editing, setEditing] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: subtask.id, data: { type: "subtask", parentId } });

  const done = subtask.status === "DONE";

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      onClick={(event) => {
        event.stopPropagation();
        callbacks.onOpen(parentId);
      }}
      className={cn(
        "group/sub flex cursor-pointer items-center gap-1.5 rounded-md py-0.5 hover:bg-accent/40",
        isDragging && "opacity-50",
      )}
    >
      <button
        type="button"
        className="grid h-6 w-5 cursor-grab place-items-center text-muted-foreground opacity-0 focus-visible:opacity-100 group-hover/sub:opacity-100"
        aria-label={`Reorder subtask ${subtask.title}`}
        title="Drag to reorder · drag left to move it out of this task"
        onClick={(event) => event.stopPropagation()}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>

      <Checkbox
        checked={done}
        aria-label={done ? `Reopen ${subtask.title}` : `Complete ${subtask.title}`}
        onClick={(event) => event.stopPropagation()}
        onCheckedChange={(checked) =>
          callbacks.onToggleSubtask(parentId, subtask.id, checked ? "DONE" : "TODO")
        }
        className="h-3.5 w-3.5"
      />

      {editing ? (
        <InlineTitleEditor
          value={subtask.title}
          ariaLabel="Subtask title"
          className="h-6 max-w-sm text-xs"
          onCommit={(title) => {
            callbacks.onRenameSubtask(parentId, subtask.id, title);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <button
          type="button"
          className={cn(
            "min-w-0 flex-1 truncate text-left text-[13px] text-muted-foreground hover:text-foreground",
            done && "line-through opacity-70",
          )}
          onClick={(event) => {
            event.stopPropagation();
            setEditing(true);
          }}
          title="Click to rename"
        >
          {subtask.title}
        </button>
      )}

      <div className="flex items-center opacity-0 transition-opacity focus-within:opacity-100 group-hover/sub:opacity-100">
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          aria-label={`Move ${subtask.title} up`}
          onClick={(event) => {
            event.stopPropagation();
            callbacks.onMoveSubtask(parentId, subtask.id, "up");
          }}
        >
          <ArrowUp className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          aria-label={`Move ${subtask.title} down`}
          onClick={(event) => {
            event.stopPropagation();
            callbacks.onMoveSubtask(parentId, subtask.id, "down");
          }}
        >
          <ArrowDown className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground"
          aria-label={`Move ${subtask.title} to the top level`}
          title="Make it a task again"
          onClick={(event) => {
            event.stopPropagation();
            callbacks.onUnnest(parentId, subtask.id);
          }}
        >
          <CornerDownRight className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground hover:text-destructive"
          aria-label={`Delete subtask ${subtask.title}`}
          onClick={(event) => {
            event.stopPropagation();
            callbacks.onDeleteSubtask(parentId, subtask.id);
          }}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </li>
  );
}

function SubtaskList({
  task,
  callbacks,
  initialAdding = false,
}: {
  task: TaskDTO;
  callbacks: RowCallbacks;
  initialAdding?: boolean;
}) {
  const [adding, setAdding] = useState(initialAdding);
  const [draft, setDraft] = useState("");
  const { setNodeRef, isOver } = useDroppable({
    id: `subtasks:${task.id}`,
    data: { type: "subtaskList", parentId: task.id },
  });

  function submit() {
    const title = draft.trim();
    if (!title) {
      setAdding(false);
      return;
    }
    callbacks.onAddSubtask(task.id, title);
    setDraft("");
  }

  return (
    <div
      ref={setNodeRef}
      onClick={(event) => event.stopPropagation()}
      className={cn("ml-7 border-l border-border/70 pl-3", isOver && "border-primary/50")}
    >
      <ul className="flex flex-col">
        {task.subtasks.map((subtask) => (
          <SubtaskRow
            key={subtask.id}
            parentId={task.id}
            subtask={subtask}
            callbacks={callbacks}
          />
        ))}
      </ul>

      {adding ? (
        <div className="flex items-center gap-1.5 py-0.5">
          <CornerDownRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <Input
            autoFocus
            value={draft}
            aria-label="New subtask title"
            placeholder="Subtask title"
            className="h-7 max-w-sm text-xs"
            onChange={(event) => setDraft(event.target.value)}
            onBlur={submit}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                submit();
              }
              if (event.key === "Escape") {
                setDraft("");
                setAdding(false);
              }
            }}
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="flex items-center gap-1 py-0.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <Plus className="h-3 w-3" />
          Add subtask
        </button>
      )}
    </div>
  );
}

export function TaskRow({
  task,
  today,
  selected,
  categories,
  categoryName,
  nestTarget,
  ...callbacks
}: TaskRowProps) {
  const [editing, setEditing] = useState(false);
  const [subtaskMode, setSubtaskMode] = useState<"hidden" | "list" | "adding">(
    task.subtasks.length > 0 ? "list" : "hidden",
  );
  const previousSubtaskCount = useRef(task.subtasks.length);

  // Show the list as soon as the task gains its first subtask (e.g. by dragging
  // another task onto it).
  useEffect(() => {
    if (previousSubtaskCount.current === 0 && task.subtasks.length > 0) {
      setSubtaskMode("list");
    }
    previousSubtaskCount.current = task.subtasks.length;
  }, [task.subtasks.length]);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id, data: { type: "task", parentId: null } });

  const done = task.status === "DONE";
  const doneSubtasks = task.subtasks.filter((subtask) => subtask.status === "DONE").length;
  const overdue =
    !done &&
    ((task.dueDate && task.dueDate < today) ||
      (task.scheduledDate && task.scheduledDate < today));

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        "group/row list-none rounded-md border border-transparent transition-colors",
        selected && "border-border bg-accent/60",
        isDragging && "opacity-50",
        nestTarget && "border-dashed border-primary/60 bg-primary/5",
        !selected && !nestTarget && "hover:bg-accent/40",
      )}
    >
      <div
        onClick={() => callbacks.onOpen(task.id)}
        className="flex cursor-pointer items-start gap-1.5 px-2 py-2"
      >
        <button
          type="button"
          className="mt-0.5 grid h-6 w-5 shrink-0 cursor-grab place-items-center text-muted-foreground opacity-0 focus-visible:opacity-100 group-hover/row:opacity-100"
          aria-label={`Reorder task ${task.title}`}
          title="Drag to reorder · drag right onto a task to make it a subtask"
          onClick={(event) => event.stopPropagation()}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>

        <Checkbox
          checked={done}
          aria-label={done ? `Reopen ${task.title}` : `Complete ${task.title}`}
          onClick={(event) => event.stopPropagation()}
          onCheckedChange={() => callbacks.onToggle(task)}
          className="mt-0.5 h-4 w-4"
        />

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {editing ? (
              <InlineTitleEditor
                value={task.title}
                ariaLabel="Task title"
                className="max-w-md"
                onCommit={(title) => {
                  callbacks.onRename(task.id, title);
                  setEditing(false);
                }}
                onCancel={() => setEditing(false)}
              />
            ) : (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  callbacks.onOpen(task.id);
                }}
                onDoubleClick={(event) => {
                  event.stopPropagation();
                  setEditing(true);
                }}
                aria-label={`Open task ${task.title}`}
                className={cn(
                  "min-w-0 truncate text-left text-sm font-medium hover:underline",
                  done && "text-muted-foreground line-through decoration-muted-foreground/50",
                )}
              >
                {task.title}
              </button>
            )}

            {task.scheduledDate ? (
              <DateChip date={task.scheduledDate} today={today} kind="scheduled" />
            ) : null}
            {task.dueDate ? (
              <DateChip date={task.dueDate} today={today} kind="due" overdue={Boolean(overdue)} />
            ) : null}
            {categoryName ? (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <span
                  aria-hidden="true"
                  className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40"
                />
                {categoryName}
              </span>
            ) : null}
            {task.subtasks.length > 0 ? (
              <SubtaskProgressLabel done={doneSubtasks} total={task.subtasks.length} />
            ) : null}
          </div>

          {task.notes ? (
            <p className="line-clamp-2 text-xs text-muted-foreground">{task.notes}</p>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          <NotesButton
            hasNotes={Boolean(task.notes)}
            ariaLabel={`Notes for ${task.title}`}
            onClick={() => callbacks.onOpenNotes(task.id)}
          />

          {task.subtasks.length > 0 ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground"
              aria-label={subtaskMode === "hidden" ? "Show subtasks" : "Hide subtasks"}
              aria-expanded={subtaskMode !== "hidden"}
              onClick={(event) => {
                event.stopPropagation();
                setSubtaskMode((mode) => (mode === "hidden" ? "list" : "hidden"));
              }}
            >
              {subtaskMode === "hidden" ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          ) : null}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground opacity-0 focus-visible:opacity-100 group-hover/row:opacity-100 data-[state=open]:opacity-100"
                aria-label={`Actions for ${task.title}`}
                onClick={(event) => event.stopPropagation()}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem onSelect={() => setEditing(true)}>
                <Pencil className="mr-2 h-4 w-4" />
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => callbacks.onOpenNotes(task.id)}>
                <Pencil className="mr-2 h-4 w-4" />
                {task.notes ? "Edit notes" : "Add notes"}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => callbacks.onToggle(task)}>
                {done ? "Reopen task" : "Complete task"}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setSubtaskMode("adding")}>
                <Plus className="mr-2 h-4 w-4" />
                Add subtask
              </DropdownMenuItem>

              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => callbacks.onMove(task.id, "up")}>
                <ArrowUp className="mr-2 h-4 w-4" />
                Move up
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => callbacks.onMove(task.id, "down")}>
                <ArrowDown className="mr-2 h-4 w-4" />
                Move down
              </DropdownMenuItem>

              <DropdownMenuSeparator />
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <CalendarDays className="mr-2 h-4 w-4" />
                  Plan for
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuItem onSelect={() => callbacks.onSchedule(task.id, today)}>
                    Today
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => callbacks.onSchedule(task.id, addDays(today, 1))}
                  >
                    Tomorrow
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => callbacks.onSchedule(task.id, addDays(today, 7))}
                  >
                    Next week
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => callbacks.onSchedule(task.id, null)}>
                    Clear date
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>

              <DropdownMenuSub>
                <DropdownMenuSubTrigger>Move to category</DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuItem onSelect={() => callbacks.onMoveToCategory(task.id, null)}>
                    No category
                  </DropdownMenuItem>
                  {categories.map((category) => (
                    <DropdownMenuItem
                      key={category.id}
                      onSelect={() => callbacks.onMoveToCategory(task.id, category.id)}
                    >
                      <span
                        aria-hidden="true"
                        className="mr-2 h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: category.color }}
                      />
                      {category.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>

              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                Drag the handle sideways to nest or un-nest
              </DropdownMenuLabel>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onSelect={() => callbacks.onDelete(task.id)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete task
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {subtaskMode !== "hidden" ? (
        <div className="pb-2">
          <SubtaskList
            task={task}
            callbacks={callbacks}
            initialAdding={subtaskMode === "adding"}
          />
        </div>
      ) : null}
    </li>
  );
}
