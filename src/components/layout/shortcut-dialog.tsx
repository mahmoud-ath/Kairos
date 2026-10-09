"use client";

import {
  CalendarDays,
  ChartNoAxesColumn,
  CircleCheckBig,
  Keyboard,
  ListTodo,
  Plus,
  Search,
  Settings,
  SunMoon,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { groupedShortcuts, keysLabel, type ShortcutId } from "@/lib/shortcuts";

const ICONS: Record<ShortcutId, typeof Search> = {
  "go-today": CalendarDays,
  "go-tasks": ListTodo,
  "go-completed": CircleCheckBig,
  "go-statistics": ChartNoAxesColumn,
  "go-settings": Settings,
  search: Search,
  "new-task": Plus,
  "toggle-theme": SunMoon,
  help: Keyboard,
};

/** A key press, or a sequence of them, drawn as key caps. */
function KeyCaps({ keys }: { keys: readonly string[] }) {
  return (
    <span className="flex items-center gap-1" aria-label={keysLabel(keys)}>
      {keys.map((key, index) => (
        <span key={key} className="flex items-center gap-1">
          {index > 0 ? (
            <span aria-hidden="true" className="text-[10px] text-muted-foreground">
              then
            </span>
          ) : null}
          <kbd
            aria-hidden="true"
            className="rounded border border-border bg-muted px-1.5 py-0.5 font-sans text-[11px] font-medium text-foreground"
          >
            {key.toUpperCase()}
          </kbd>
        </span>
      ))}
    </span>
  );
}

/** Every shortcut that works, listed the way the sidebar is ordered. */
export function ShortcutDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription className="sr-only">
            Keyboard shortcuts available in the workspace.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {groupedShortcuts().map(({ group, items }) => (
            <div key={group} className="flex flex-col gap-0.5">
              <h3 className="px-1.5 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {group}
              </h3>
              {items.map(({ id, label, keys }) => {
                const Icon = ICONS[id];
                return (
                  <div
                    key={id}
                    className="flex items-center gap-3 rounded-md px-1.5 py-1.5 transition-colors hover:bg-accent"
                  >
                    <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <span className="text-sm">{label}</span>
                    <span className="ml-auto">
                      <KeyCaps keys={keys} />
                    </span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
