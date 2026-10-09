"use client";

import { Keyboard } from "lucide-react";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";

import { ShortcutDialog } from "@/components/layout/shortcut-dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  normalizeKey,
  resolveShortcut,
  SEQUENCE_TIMEOUT_MS,
  type Pending,
  type ShortcutId,
} from "@/lib/shortcuts";
import { updateSettingsAction } from "@/server/actions/settings";

type ShortcutContextValue = { openHelp: () => void };

const ShortcutContext = createContext<ShortcutContextValue | null>(null);

export function useShortcuts(): ShortcutContextValue {
  const context = useContext(ShortcutContext);
  if (!context) {
    throw new Error("useShortcuts must be used inside the app shell.");
  }
  return context;
}

/** Is the key press going into a text field? Then it is not a shortcut. */
function isTypingTarget(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  if (!element) return false;
  return (
    element.tagName === "INPUT" ||
    element.tagName === "TEXTAREA" ||
    element.tagName === "SELECT" ||
    element.isContentEditable
  );
}

function focusFirst(selector: string): boolean {
  const element = document.querySelector<HTMLElement>(selector);
  if (!element) return false;
  element.focus();
  // Text already in the field is selected, so typing replaces it.
  if (element instanceof HTMLInputElement) element.select();
  return true;
}

/**
 * One keyboard listener for the whole workspace.
 *
 * Mounted inside the app shell, which is what keeps the landing and sign-in
 * pages free of it. The rules it applies are in `src/lib/shortcuts.ts`; this
 * component only decides *when* they are allowed to run:
 *
 *   - never while the focus is in a text field (except Escape, which leaves it)
 *   - never while a modal is open — it owns the keyboard
 *   - never with a modifier, so browser and OS shortcuts stay untouched
 */
export function ShortcutProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const [helpOpen, setHelpOpen] = useState(false);

  const pending = useRef<Pending>([]);
  const timer = useRef<number | null>(null);

  const openHelp = useCallback(() => setHelpOpen(true), []);

  /**
   * Kept in a ref so the listener below never has to be re-registered: the
   * effect runs once, and the closure still sees the current theme and router.
   */
  const run = useRef<(id: ShortcutId) => void>(() => {});

  run.current = (id) => {
    switch (id) {
      case "go-today":
        router.push("/today");
        break;
      case "go-tasks":
        router.push("/tasks");
        break;
      case "go-completed":
        router.push("/completed");
        break;
      case "go-statistics":
        router.push("/statistics");
        break;
      case "go-settings":
        router.push("/settings");
        break;
      case "search":
        // The toolbar only exists in the workspace; anywhere else, go there.
        if (!focusFirst('[aria-label="Search tasks"]')) router.push("/today");
        break;
      case "new-task":
        if (!focusFirst('[aria-label="New task title"]')) router.push("/today");
        break;
      case "toggle-theme": {
        const next = resolvedTheme === "dark" ? "light" : "dark";
        setTheme(next);
        void updateSettingsAction({ theme: next }).then((result) => {
          if (!result.ok) {
            toast.error("Couldn't save the theme", { description: result.error });
          }
        });
        break;
      }
      case "help":
        setHelpOpen(true);
        break;
    }
  };

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey || event.repeat) return;

      const key = normalizeKey(event.key);

      if (key === "escape") {
        const active = document.activeElement as HTMLElement | null;
        if (active && isTypingTarget(active)) active.blur();
        return;
      }

      if (isTypingTarget(event.target)) return;
      if (document.querySelector('[role="dialog"][data-state="open"]')) return;

      const { shortcut, pending: next } = resolveShortcut(pending.current, key);
      pending.current = next;

      if (timer.current !== null) window.clearTimeout(timer.current);
      if (next.length > 0) {
        timer.current = window.setTimeout(() => {
          pending.current = [];
        }, SEQUENCE_TIMEOUT_MS);
      }

      if (!shortcut) return;

      event.preventDefault();
      pending.current = [];
      run.current(shortcut.id);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      if (timer.current !== null) window.clearTimeout(timer.current);
    };
  }, []);

  return (
    <ShortcutContext.Provider value={{ openHelp }}>
      {children}
      <ShortcutDialog open={helpOpen} onOpenChange={setHelpOpen} />
    </ShortcutContext.Provider>
  );
}

/** The discoverable way in: a keyboard button in the sidebar. */
export function ShortcutTrigger({ className }: { className?: string }) {
  const { openHelp } = useShortcuts();

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={openHelp}
          aria-label="Keyboard shortcuts"
          className={cn(
            "grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground",
            className,
          )}
        >
          <Keyboard className="h-4 w-4" aria-hidden="true" />
        </button>
      </TooltipTrigger>
      <TooltipContent>Keyboard shortcuts (?)</TooltipContent>
    </Tooltip>
  );
}
