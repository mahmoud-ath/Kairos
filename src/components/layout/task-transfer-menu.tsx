"use client";

import { DatabaseBackup, Download, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  parseTaskTransferText,
  TASK_TRANSFER_MAX_BYTES,
  type TaskTransferSummary,
} from "@/lib/task-transfer";
import { importTasksAction } from "@/server/actions/task-transfer";

/**
 * The top bar's JSON transfer tools: export the task list, or merge a file back
 * in.
 *
 * Only rendered when the account switched the tools on in settings. Export is a
 * plain download link (`/api/tasks/export`), so it needs no client round trip.
 * Import validates the whole file in the browser first, shows what it contains,
 * and only then asks the server to write it — an import *adds* tasks and never
 * deletes the existing ones.
 */
export function TaskTransferMenu() {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<{ json: string; summary: TaskTransferSummary } | null>(
    null,
  );
  const [importing, setImporting] = useState(false);

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (file.size > TASK_TRANSFER_MAX_BYTES) {
      toast.error("That file can't be imported", {
        description: "It is larger than the 20 MB limit.",
      });
      return;
    }

    const text = await file.text();
    const validation = parseTaskTransferText(text);
    if (!validation.ok) {
      toast.error("That file can't be imported", {
        description: validation.errors[0],
      });
      return;
    }
    setPending({ json: text, summary: validation.summary });
  }

  async function confirmImport() {
    if (!pending) return;
    setImporting(true);
    const result = await importTasksAction({ json: pending.json });
    setImporting(false);
    if (!result.ok) {
      toast.error("The import failed", { description: result.error });
      return;
    }

    const summary = result.data?.summary;
    setPending(null);
    toast.success("Tasks imported", {
      description: summary
        ? `Added ${summary.tasks} task${summary.tasks === 1 ? "" : "s"} and ${summary.subtasks} subtask${summary.subtasks === 1 ? "" : "s"}.`
        : undefined,
    });
    // The list and the sidebar counters are server-rendered.
    router.refresh();
  }

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 text-muted-foreground"
                  aria-label="Export or import tasks"
                >
                  <DatabaseBackup className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuLabel className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium">Tasks as JSON</span>
                  <span className="text-xs font-normal text-muted-foreground">
                    Import adds tasks; nothing is deleted.
                  </span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <a href="/api/tasks/export" download>
                    <Download />
                    Export tasks
                  </a>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => {
                    // Let the menu close before the picker opens, or the dialog's
                    // focus trap swallows the click.
                    window.setTimeout(() => fileInput.current?.click(), 0);
                  }}
                >
                  <Upload />
                  Import tasks…
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </span>
        </TooltipTrigger>
        <TooltipContent>Export / import tasks</TooltipContent>
      </Tooltip>

      <input
        ref={fileInput}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={handleFile}
      />

      {/* Import preview: the file is validated before anything is written. */}
      <Dialog open={Boolean(pending)} onOpenChange={(open) => !open && setPending(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Import these tasks?</DialogTitle>
            <DialogDescription>
              They are added to this workspace. Existing tasks are not changed.
            </DialogDescription>
          </DialogHeader>

          {pending ? (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-md border border-border px-3 py-3 text-sm">
              <dt className="text-muted-foreground">Exported</dt>
              <dd className="text-right">
                {pending.summary.exportedAt
                  ? new Date(pending.summary.exportedAt).toLocaleDateString()
                  : "unknown"}
              </dd>
              <dt className="text-muted-foreground">Tasks</dt>
              <dd className="text-right tabular-nums">{pending.summary.tasks}</dd>
              <dt className="text-muted-foreground">Subtasks</dt>
              <dd className="text-right tabular-nums">{pending.summary.subtasks}</dd>
              <dt className="text-muted-foreground">Completed</dt>
              <dd className="text-right tabular-nums">{pending.summary.completed}</dd>
              <dt className="text-muted-foreground">Categories</dt>
              <dd className="text-right">{pending.summary.categories.length}</dd>
            </dl>
          ) : null}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setPending(null)} disabled={importing}>
              Cancel
            </Button>
            <Button onClick={() => void confirmImport()} disabled={importing}>
              {importing ? "Importing…" : "Import tasks"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
