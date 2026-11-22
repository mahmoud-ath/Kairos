"use client";

import { Download } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { CategoryDTO } from "@/types/kairos";

/** Counts shown next to each choice, so the reader knows what they are getting. */
export type ExportCounts = {
  /** Top-level tasks and subtasks, habits excluded. */
  total: number;
  /** Unfinished top-level tasks. */
  open: number;
  /** Unfinished top-level tasks per category id. */
  openByCategory: Record<string, number>;
};

type Scope = "all" | "open" | "category";

const SCOPES: Array<{ value: Scope; label: string; hint: string }> = [
  { value: "all", label: "Everything", hint: "Every task, subtask, category, habit and history event." },
  { value: "open", label: "Only open tasks", hint: "Unfinished work, without completed tasks or history." },
  { value: "category", label: "One category", hint: "That category, its subtasks and its habits." },
];

function filenameFrom(response: Response): string | null {
  const disposition = response.headers.get("Content-Disposition") ?? "";
  const match = /filename="?([^";]+)"?/i.exec(disposition);
  return match?.[1] ?? null;
}

/**
 * Choose what to export, then download it.
 *
 * The download goes through `fetch` rather than a plain link so a refusal (a
 * rate limit, a category deleted in another tab) can be explained instead of
 * navigating the page to a JSON error.
 */
export function ExportDialog({
  categories,
  counts,
}: {
  categories: CategoryDTO[];
  counts: ExportCounts;
}) {
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<Scope>("all");
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [includeHistory, setIncludeHistory] = useState(true);
  const [downloading, setDownloading] = useState(false);

  const selectedCategory = categories.find((category) => category.id === categoryId);
  const taskCount =
    scope === "all"
      ? counts.total
      : scope === "open"
        ? counts.open
        : (counts.openByCategory[categoryId] ?? 0);
  const canDownload = scope !== "category" || Boolean(categoryId);

  async function download() {
    if (!canDownload) return;
    setDownloading(true);
    const params = new URLSearchParams({ scope });
    if (scope === "category") params.set("categoryId", categoryId);
    if (!includeHistory) params.set("history", "0");

    try {
      const response = await fetch(`/api/backup?${params.toString()}`);
      if (!response.ok) {
        toast.error("Couldn't create the export", {
          description: (await response.text()) || "Please try again.",
        });
        return;
      }
      const blob = await response.blob();
      const filename = filenameFrom(response) ?? "kairos-backup.json";
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(url);
      toast.success("Export downloaded", { description: filename });
      setOpen(false);
    } catch {
      toast.error("Couldn't create the export", {
        description: "Check your connection and try again.",
      });
    } finally {
      setDownloading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Download className="mr-1.5 h-4 w-4" />
          Export JSON
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Export a JSON backup</DialogTitle>
          <DialogDescription>
            Pick what to include. Importing a file never deletes anything — it adds the tasks it
            holds to this workspace.
          </DialogDescription>
        </DialogHeader>

        <fieldset className="flex flex-col gap-2">
          <legend className="sr-only">What to export</legend>
          {SCOPES.map((option) => {
            const disabled = option.value === "category" && categories.length === 0;
            const checked = scope === option.value;
            return (
              <label
                key={option.value}
                className={cn(
                  "flex cursor-pointer items-start gap-2.5 rounded-md border border-border px-3 py-2 transition-colors",
                  checked && "border-primary/50 bg-primary/5",
                  disabled && "cursor-not-allowed opacity-50",
                )}
              >
                <input
                  type="radio"
                  name="export-scope"
                  value={option.value}
                  checked={checked}
                  disabled={disabled}
                  onChange={() => setScope(option.value)}
                  className="mt-1 h-3.5 w-3.5 accent-[hsl(var(--primary))]"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{option.label}</span>
                  <span className="block text-xs text-muted-foreground">{option.hint}</span>
                </span>
              </label>
            );
          })}
        </fieldset>

        {scope === "category" ? (
          <div className="space-y-1.5">
            <Label htmlFor="export-category" className="text-xs">
              Category
            </Label>
            <select
              id="export-category"
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            >
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                  {counts.openByCategory[category.id]
                    ? ` (${counts.openByCategory[category.id]} open)`
                    : ""}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div className="flex items-center gap-2">
          <input
            id="export-history"
            type="checkbox"
            className="h-3.5 w-3.5 accent-[hsl(var(--primary))]"
            checked={includeHistory}
            onChange={(event) => setIncludeHistory(event.target.checked)}
          />
          <Label htmlFor="export-history" className="text-xs font-normal">
            Include task history
          </Label>
        </div>

        <p className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
          {taskCount} task{taskCount === 1 ? "" : "s"}
          {scope === "category" && selectedCategory ? ` in “${selectedCategory.name}”` : ""}
          {scope === "open" ? " still open" : ""}
          {includeHistory ? " · with history" : " · no history"}. Importing it later adds these
          rows; it never removes any.
        </p>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={downloading}>
            Cancel
          </Button>
          <Button onClick={() => void download()} disabled={downloading || !canDownload}>
            {downloading ? "Preparing…" : "Download"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
