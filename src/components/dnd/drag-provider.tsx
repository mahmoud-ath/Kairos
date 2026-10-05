"use client";

import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import {
  createContext,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";

/**
 * Drag-and-drop lives in the shell because a drag can start in the task list and
 * end on a category in the sidebar. The active page registers its handlers here;
 * the shell owns the single `DndContext` (and the drag overlay).
 */
export type DragHandlers = {
  onDragStart?: (activeId: string) => void;
  onDragEnd?: (event: DragEndEvent) => void;
  onDragCancel?: () => void;
  renderOverlay?: (activeId: string) => ReactNode;
};

type DragRegistryValue = {
  handlers: RefObject<DragHandlers>;
};

const DragRegistryContext = createContext<DragRegistryValue | null>(null);

export function useDragRegistry(): DragRegistryValue {
  const context = useContext(DragRegistryContext);
  if (!context) throw new Error("useDragRegistry must be used inside the app shell.");
  return context;
}

export function DragProvider({ children }: { children: ReactNode }) {
  const handlers = useRef<DragHandlers>({});
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    // A small activation distance keeps clicks (checkbox, inline edit) working.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const value = useMemo<DragRegistryValue>(() => ({ handlers }), []);

  function handleDragStart(event: DragStartEvent) {
    const id = String(event.active.id);
    setActiveId(id);
    handlers.current.onDragStart?.(id);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    handlers.current.onDragEnd?.(event);
  }

  function handleDragCancel() {
    setActiveId(null);
    handlers.current.onDragCancel?.();
  }

  return (
    <DragRegistryContext.Provider value={value}>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        {children}
        <DragOverlay dropAnimation={null}>
          {activeId ? handlers.current.renderOverlay?.(activeId) : null}
        </DragOverlay>
      </DndContext>
    </DragRegistryContext.Provider>
  );
}
