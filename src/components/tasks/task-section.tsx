"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";

import { TaskRow, type RowCallbacks } from "@/components/tasks/task-row";
import { SECTION_PREFIX } from "@/components/tasks/dnd-utils";
import { cn } from "@/lib/utils";
import type { TaskSection } from "@/lib/views";
import type { CategoryDTO, TaskDTO } from "@/types/kairos";

type TaskSectionViewProps = RowCallbacks & {
  section: TaskSection<TaskDTO>;
  today: string;
  selectedId: string | null;
  categories: readonly CategoryDTO[];
  categoryNames: ReadonlyMap<string, string>;
  showCategory: boolean;
  /** Sections whose order can be changed by dragging. */
  sortable: boolean;
};

export function TaskSectionView({
  section,
  today,
  selectedId,
  categories,
  categoryNames,
  showCategory,
  sortable,
  ...callbacks
}: TaskSectionViewProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `${SECTION_PREFIX}${section.key}`,
    data: { type: "section", key: section.key },
  });

  const openCount = section.tasks.filter((task) => task.status !== "DONE").length;

  return (
    <section aria-labelledby={`section-${section.key}`} className="flex flex-col gap-1">
      <header className="flex items-baseline gap-2 px-2 pt-4">
        <h2
          id={`section-${section.key}`}
          className={cn(
            "text-xs font-semibold uppercase tracking-wide",
            section.kind === "overdue" ? "text-destructive" : "text-muted-foreground",
          )}
        >
          {section.title}
        </h2>
        <span className="text-xs tabular-nums text-muted-foreground">
          {section.kind === "completed" ? section.tasks.length : openCount}
        </span>
      </header>

      <div
        ref={setNodeRef}
        className={cn(
          "rounded-lg border border-transparent px-1 pb-1 transition-colors",
          isOver && "border-primary/30 bg-primary/5",
        )}
      >
        {section.tasks.length === 0 ? (
          <p className="px-3 py-2 text-xs text-muted-foreground">
            Nothing here yet — drop a task or use the field above.
          </p>
        ) : (
          <SortableContext
            items={section.tasks.map((task) => task.id)}
            strategy={verticalListSortingStrategy}
            disabled={!sortable}
          >
            <ul className="flex flex-col">
              {section.tasks.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  today={today}
                  selected={selectedId === task.id}
                  categories={categories}
                  categoryName={
                    showCategory && task.categoryId
                      ? (categoryNames.get(task.categoryId) ?? null)
                      : null
                  }
                  {...callbacks}
                />
              ))}
            </ul>
          </SortableContext>
        )}
      </div>
    </section>
  );
}
