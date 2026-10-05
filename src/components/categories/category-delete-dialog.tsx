"use client";

import { useState } from "react";
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
import type { CategoryDTO } from "@/types/kairos";
import { deleteCategoryAction } from "@/server/actions/taxonomy";

/** Deleting a category never deletes tasks: they move to Uncategorized. */
export function CategoryDeleteDialog({
  open,
  onOpenChange,
  category,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: CategoryDTO;
}) {
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    const result = await deleteCategoryAction({ id: category.id });
    setDeleting(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    const moved = result.data?.movedTasks ?? 0;
    toast.success(
      moved > 0
        ? `Category deleted · ${moved} task${moved === 1 ? "" : "s"} moved to Uncategorized`
        : "Category deleted",
    );
    onOpenChange(false);
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete “{category.name}”?</AlertDialogTitle>
          <AlertDialogDescription>
            Tasks in this category are kept and move to{" "}
            <span className="font-medium text-foreground">Uncategorized</span>. Labels, subtasks and
            history are unaffected. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(event) => {
              event.preventDefault();
              void handleDelete();
            }}
            disabled={deleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleting ? "Deleting…" : "Delete category"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
