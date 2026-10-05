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
  type DragMoveEvent,
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

import type { DragIntent } from "@/components/tasks/dnd-utils";

/**
 * Drag and drop lives in the shell because a drag can start in the task list and
 * end on a category in the sidebar. The active page registers its handlers here;
 * the shell owns the single `DndContext` (and the drag overlay).
 */
export type DragHandlers = {
  onDragStart?: (activeId: string) => void;
  onDragEnd?: (event: DragEndEvent) => void;
  onDragCancel?: () => void;
  /** Renders the floating preview; receives the current drop intent. */
  renderOverlay?: (activeId: string, intent: DragIntent | null) => ReactNode;
  /**
   * Decides what a drop would mean right now (reorder, nest, un-nest, move to a
   * category) so the UI can show the user what is about to happen.
   */
  resolveIntent?: (activeId: string, overId: string, deltaX: number) => DragIntent;
};

type DragRegistryValue = {
  handlers: RefObject<DragHandlers>;
};

export type DragState = {
  activeId: string | null;
  overId: string | null;
  intent: DragIntent | null;
};

const DragRegistryContext = createContext<DragRegistryValue | null>(null);
const DragStateContext = createContext<DragState>({
  activeId: null,
  overId: null,
  intent: null,
});

export function useDragRegistry(): DragRegistryValue {
  const context = useContext(DragRegistryContext);
  if (!context) throw new Error("useDragRegistry must be used inside the app shell.");
  return context;
}

/** Live drag information for highlighting drop targets. */
export function useDragState(): DragState {
  return useContext(DragStateContext);
}

export function DragProvider({ children }: { children: ReactNode }) {
  const handlers = useRef<DragHandlers>({});
  const [state, setState] = useState<DragState>({
    activeId: null,
    overId: null,
    intent: null,
  });

  const sensors = useSensors(
    // A small activation distance keeps clicks (checkbox, inline edit) working.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const value = useMemo<DragRegistryValue>(() => ({ handlers }), []);

  function handleDragStart(event: DragStartEvent) {
    const id = String(event.active.id);
    setState({ activeId: id, overId: null, intent: null });
    handlers.current.onDragStart?.(id);
  }

  function handleDragMove(event: DragMoveEvent) {
    const overId = event.over ? String(event.over.id) : null;
    const intent = overId
      ? (handlers.current.resolveIntent?.(
          String(event.active.id),
          overId,
          event.delta.x,
        ) ?? null)
      : null;

    setState((previous) =>
      previous.overId === overId && previous.intent === intent
        ? previous
        : { ...previous, overId, intent },
    );
  }

  function handleDragEnd(event: DragEndEvent) {
    setState({ activeId: null, overId: null, intent: null });
    handlers.current.onDragEnd?.(event);
  }

  function handleDragCancel() {
    setState({ activeId: null, overId: null, intent: null });
    handlers.current.onDragCancel?.();
  }

  return (
    <DragRegistryContext.Provider value={value}>
      <DragStateContext.Provider value={state}>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragMove={handleDragMove}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          {children}
          <DragOverlay dropAnimation={null}>
            {state.activeId
              ? handlers.current.renderOverlay?.(state.activeId, state.intent)
              : null}
          </DragOverlay>
        </DndContext>
      </DragStateContext.Provider>
    </DragRegistryContext.Provider>
  );
}
