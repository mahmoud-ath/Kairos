"use client";

import { MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { CategoryDeleteDialog } from "@/components/categories/category-delete-dialog";
import { CategoryDialog } from "@/components/categories/category-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { CategoryDTO } from "@/types/kairos";

/** Manage categories: the only way tasks are grouped. */
export function TaxonomyManager({ categories }: { categories: readonly CategoryDTO[] }) {
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<CategoryDTO | null>(null);
  const [deleting, setDeleting] = useState<CategoryDTO | null>(null);

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border bg-card px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Categories</h2>
          <p className="text-xs text-muted-foreground">
            Categories group your tasks in the sidebar and are the only grouping Kairos uses.
            Deleting one keeps its tasks — they move to Uncategorized.
          </p>
        </div>
        <Button variant="outline" size="sm" className="h-8 shrink-0" onClick={() => setCreating(true)}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Add
        </Button>
      </div>

      {categories.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No categories yet. Create one here, from the sidebar, or while editing a task.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-md border border-border">
          {categories.map((category) => (
            <li key={category.id} className="flex items-center gap-3 px-3 py-2">
              <span
                aria-hidden="true"
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: category.color }}
              />
              <span className="min-w-0 flex-1 truncate text-sm">{category.name}</span>
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                {category.openTaskCount} open
              </span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    aria-label={`Category options for ${category.name}`}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  <DropdownMenuItem onSelect={() => setEditing(category)}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Rename
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onSelect={() => setDeleting(category)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </li>
          ))}
        </ul>
      )}

      <CategoryDialog open={creating} onOpenChange={setCreating} />
      <CategoryDialog
        open={Boolean(editing)}
        onOpenChange={(open) => !open && setEditing(null)}
        category={editing ?? undefined}
      />
      {deleting ? (
        <CategoryDeleteDialog
          open={Boolean(deleting)}
          onOpenChange={(open) => !open && setDeleting(null)}
          category={deleting}
        />
      ) : null}
    </section>
  );
}
