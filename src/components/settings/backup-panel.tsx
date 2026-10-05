"use client";

import { AlertTriangle, Download, RotateCcw, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { parseBackupText, type BackupSummary } from "@/lib/backup";
import { importBackupAction, resetAllDataAction } from "@/server/actions/settings";

/**
 * Export, import and reset.
 *
 * Import validates the whole file (including every cross-reference) before it
 * shows a summary, then replaces the database inside a single transaction.
 * Exported files are private user data — never commit them, and keep them
 * somewhere you trust.
 */
export function BackupPanel({ taskCount }: { taskCount: number }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<{ json: string; summary: BackupSummary } | null>(null);
  const [errors, setErrors] = useState<string[] | null>(null);
  const [importing, setImporting] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetPhrase, setResetPhrase] = useState("");
  const [resetting, setResetting] = useState(false);

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (file.size > 50_000_000) {
      setErrors(["That file is larger than 50 MB."]);
      return;
    }

    const text = await file.text();
    const validation = parseBackupText(text);
    if (!validation.ok) {
      setPending(null);
      setErrors(validation.errors);
      return;
    }
    setErrors(null);
    setPending({ json: text, summary: validation.summary });
  }

  async function confirmImport() {
    if (!pending) return;
    setImporting(true);
    const result = await importBackupAction({ json: pending.json });
    setImporting(false);
    if (!result.ok) {
      setErrors(result.fieldErrors?.file ?? [result.error]);
      return;
    }
    setPending(null);
    toast.success("Backup imported", {
      description: `Restored ${result.data?.summary.tasks ?? 0} tasks and ${result.data?.summary.subtasks ?? 0} subtasks.`,
    });
  }

  async function confirmReset() {
    setResetting(true);
    const result = await resetAllDataAction({ confirm: "RESET" });
    setResetting(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setResetOpen(false);
    setResetPhrase("");
    toast.success("All data deleted");
  }

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border bg-card px-4 py-4">
      <div>
        <h2 className="text-sm font-semibold">Backup &amp; data</h2>
        <p className="text-xs text-muted-foreground">
          Backups are plain JSON files containing tasks, subtasks, categories, history and
          settings. They are private data — store them somewhere safe and never commit them to a
          repository. Files exported by version 1 of Kairos can still be imported; their labels and
          priorities are ignored.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" asChild>
          <a href="/api/backup" download>
            <Download className="mr-1.5 h-4 w-4" />
            Export JSON
          </a>
        </Button>

        <Button variant="outline" onClick={() => fileInput.current?.click()}>
          <Upload className="mr-1.5 h-4 w-4" />
          Import JSON
        </Button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={handleFile}
        />
      </div>

      <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/5 px-3 py-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <div className="text-xs text-muted-foreground">
          <p className="font-medium text-foreground">Reset all data</p>
          <p>
            Deletes all {taskCount} tasks, subtasks, categories, labels and history, and returns the
            settings to their defaults.
          </p>
          <Button
            variant="ghost"
            size="sm"
            className="mt-1 h-7 px-2 text-destructive hover:text-destructive"
            onClick={() => setResetOpen(true)}
          >
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            Reset everything
          </Button>
        </div>
      </div>

      {/* Import preview: the file is validated before anything is replaced. */}
      <Dialog open={Boolean(pending)} onOpenChange={(open) => !open && setPending(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Replace all data with this backup?</DialogTitle>
            <DialogDescription>
              Importing replaces your current tasks, categories, labels, history and settings. This
              cannot be undone — export a backup first if you are unsure.
            </DialogDescription>
          </DialogHeader>

          {pending ? (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-md border border-border px-3 py-3 text-sm">
              <dt className="text-muted-foreground">Format version</dt>
              <dd className="text-right tabular-nums">{pending.summary.version}</dd>
              <dt className="text-muted-foreground">Exported</dt>
              <dd className="text-right">{pending.summary.exportedAt ?? "unknown"}</dd>
              <dt className="text-muted-foreground">Tasks</dt>
              <dd className="text-right tabular-nums">{pending.summary.tasks}</dd>
              <dt className="text-muted-foreground">Subtasks</dt>
              <dd className="text-right tabular-nums">{pending.summary.subtasks}</dd>
              <dt className="text-muted-foreground">Completed</dt>
              <dd className="text-right tabular-nums">{pending.summary.completedTasks}</dd>
              <dt className="text-muted-foreground">Categories</dt>
              <dd className="text-right tabular-nums">{pending.summary.categories}</dd>
              <dt className="text-muted-foreground">History events</dt>
              <dd className="text-right tabular-nums">{pending.summary.events}</dd>
              <dt className="text-muted-foreground">Timezone</dt>
              <dd className="text-right">{pending.summary.timezone}</dd>
            </dl>
          ) : null}

          {pending && pending.summary.warnings.length > 0 ? (
            <ul className="max-h-32 list-disc overflow-y-auto rounded-md border border-amber-500/40 bg-amber-500/5 px-5 py-2 text-xs text-muted-foreground">
              {pending.summary.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          ) : null}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setPending(null)} disabled={importing}>
              Cancel
            </Button>
            <Button onClick={() => void confirmImport()} disabled={importing}>
              {importing ? "Importing…" : "Replace data"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Validation problems are reported without touching the database. */}
      <Dialog open={Boolean(errors)} onOpenChange={(open) => !open && setErrors(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>This file could not be imported</DialogTitle>
            <DialogDescription>
              Nothing was changed. Fix the problems below or export a fresh backup.
            </DialogDescription>
          </DialogHeader>
          <ul className="max-h-64 list-disc overflow-y-auto px-5 text-sm text-destructive">
            {errors?.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
          <DialogFooter>
            <Button variant="outline" onClick={() => setErrors(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete everything?</AlertDialogTitle>
            <AlertDialogDescription>
              This deletes every task, subtask, category, label and event in your database and
              resets the settings. Type <span className="font-mono font-medium">RESET</span> to
              confirm.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="reset-confirmation" className="sr-only">
              Type RESET to confirm
            </Label>
            <Input
              id="reset-confirmation"
              value={resetPhrase}
              onChange={(event) => setResetPhrase(event.target.value)}
              placeholder="RESET"
              autoComplete="off"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={resetting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={resetPhrase !== "RESET" || resetting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault();
                void confirmReset();
              }}
            >
              {resetting ? "Deleting…" : "Delete all data"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
