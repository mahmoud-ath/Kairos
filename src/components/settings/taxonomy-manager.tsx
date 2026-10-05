"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { CategoryDeleteDialog } from "@/components/categories/category-delete-dialog";
import { CategoryDialog } from "@/components/categories/category-dialog";
import { ColorPicker } from "@/components/taxonomy/color-picker";
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
import { CATEGORY_COLORS, UNCATEGORIZED_LABEL } from "@/lib/constants";
import type { CategoryDTO, LabelDTO } from "@/types/kairos";
import {
  createLabelAction,
  deleteLabelAction,
  reorderCategoriesAction,
  updateLabelAction,
} from "@/server/actions/taxonomy";

function LabelDialog({
  open,
  onOpenChange,
  label,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  label?: LabelDTO;
}) {
  const isEdit = Boolean(label);
  const [name, setName] = useState(label?.name ?? "");
  const [color, setColor] = useState(label?.color ?? CATEGORY_COLORS[5]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const result = isEdit
      ? await updateLabelAction({ id: label!.id, name, color })
      : await createLabelAction({ name, color });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    toast.success(isEdit ? "Label updated" : "Label created");
    onOpenChange(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (next) {
          setName(label?.name ?? "");
          setColor(label?.color ?? CATEGORY_COLORS[5]);
          setError(null);
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{isEdit ? "Edit label" : "New label"}</DialogTitle>
            <DialogDescription>
              Labels are cross-cutting tags: a task can carry several of them.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2">
            <Label htmlFor="label-name">Name</Label>
            <Input
              id="label-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={60}
              autoFocus
              required
              placeholder="Deep work"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Color</Label>
            <ColorPicker
              value={color}
              onChange={setColor}
              colors={CATEGORY_COLORS}
              label="Label color"
            />
          </div>

          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || name.trim().length === 0}>
              {saving ? "Saving…" : isEdit ? "Save changes" : "Create label"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Manage categories and labels: rename, recolor, reorder and delete. */
export function TaxonomyManager({
  categories,
  labels,
}: {
  categories: readonly CategoryDTO[];
  labels: readonly LabelDTO[];
}) {
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CategoryDTO | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<CategoryDTO | null>(null);
  const [labelDialog, setLabelDialog] = useState<{ open: boolean; label?: LabelDTO }>({
    open: false,
  });
  const [deletingLabel, setDeletingLabel] = useState<LabelDTO | null>(null);

  async function moveCategory(index: number, direction: -1 | 1) {
    const next = [...categories];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved);
    const result = await reorderCategoriesAction({ ids: next.map((category) => category.id) });
    if (!result.ok) toast.error(result.error);
  }

  async function removeLabel(label: LabelDTO) {
    const result = await deleteLabelAction({ id: label.id });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(`Label “${label.name}” deleted · tasks were kept`);
    setDeletingLabel(null);
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3 rounded-lg border border-border bg-card px-4 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold">Categories</h2>
            <p className="text-xs text-muted-foreground">
              Categories appear in the sidebar and can be a drag target for tasks.
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={() => setCreatingCategory(true)}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Add
          </Button>
        </div>

        {categories.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No categories yet. Tasks without one live in{" "}
            <span className="font-medium text-foreground">{UNCATEGORIZED_LABEL}</span>.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {categories.map((category, index) => (
              <li key={category.id} className="flex items-center gap-2 py-2">
                <span
                  aria-hidden="true"
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: category.color }}
                />
                <span className="min-w-0 flex-1 truncate text-sm">{category.name}</span>
                <span className="text-xs text-muted-foreground">
                  {category.openTaskCount} open
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  aria-label={`Move ${category.name} up`}
                  disabled={index === 0}
                  onClick={() => void moveCategory(index, -1)}
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  aria-label={`Move ${category.name} down`}
                  disabled={index === categories.length - 1}
                  onClick={() => void moveCategory(index, 1)}
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7"
                  onClick={() => setEditingCategory(category)}
                >
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  aria-label={`Delete ${category.name}`}
                  onClick={() => setDeletingCategory(category)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3 rounded-lg border border-border bg-card px-4 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold">Labels</h2>
            <p className="text-xs text-muted-foreground">
              Labels are never required, and deleting one keeps its tasks.
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={() => setLabelDialog({ open: true })}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Add
          </Button>
        </div>

        {labels.length === 0 ? (
          <p className="text-sm text-muted-foreground">No labels yet.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {labels.map((label) => (
              <li
                key={label.id}
                className="flex items-center gap-2 rounded-md border border-border px-2.5 py-1.5"
              >
                <span
                  aria-hidden="true"
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: label.color }}
                />
                <span className="text-sm">{label.name}</span>
                <button
                  type="button"
                  className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                  onClick={() => setLabelDialog({ open: true, label })}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="text-xs text-muted-foreground underline-offset-2 hover:text-destructive hover:underline"
                  onClick={() => setDeletingLabel(label)}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <CategoryDialog open={creatingCategory} onOpenChange={setCreatingCategory} />
      <CategoryDialog
        open={Boolean(editingCategory)}
        onOpenChange={(open) => setEditingCategory(open ? editingCategory : null)}
        category={editingCategory ?? undefined}
      />
      {deletingCategory ? (
        <CategoryDeleteDialog
          open
          onOpenChange={(open) => setDeletingCategory(open ? deletingCategory : null)}
          category={deletingCategory}
        />
      ) : null}

      <LabelDialog
        open={labelDialog.open}
        onOpenChange={(open) => setLabelDialog({ open, label: open ? labelDialog.label : undefined })}
        label={labelDialog.label}
      />

      <Dialog
        open={Boolean(deletingLabel)}
        onOpenChange={(open) => setDeletingLabel(open ? deletingLabel : null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete label “{deletingLabel?.name}”?</DialogTitle>
            <DialogDescription>
              The label is removed from every task. The tasks themselves stay exactly as they are.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeletingLabel(null)}>
              Cancel
            </Button>
            <Button
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deletingLabel && void removeLabel(deletingLabel)}
            >
              Delete label
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
