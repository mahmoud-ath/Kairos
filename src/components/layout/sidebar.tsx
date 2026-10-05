"use client";

import {
  ChartNoAxesColumn,
  Monitor,
  Moon,
  MoreHorizontal,
  Pencil,
  Plus,
  Settings,
  Sun,
  Trash2,
} from "lucide-react";
import { useTheme } from "next-themes";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { useAppData } from "@/components/app-data";
import { NAV_ITEMS } from "@/components/layout/nav-items";
import { CategoryDialog } from "@/components/categories/category-dialog";
import { CategoryDeleteDialog } from "@/components/categories/category-delete-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useDroppable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import type { CategoryDTO } from "@/types/kairos";

function CategoryRow({
  category,
  active,
  onNavigate,
}: {
  category: CategoryDTO;
  active: boolean;
  onNavigate?: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `category:${category.id}` });
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "group/category flex items-center gap-1 rounded-md pr-1 transition-colors",
        isOver && "bg-primary/10 ring-1 ring-primary/40",
        active && "bg-sidebar-accent",
      )}
    >
      <Link
        href={`/categories/${category.id}`}
        onClick={onNavigate}
        className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-sidebar-accent focus-visible:bg-sidebar-accent"
      >
        <span
          aria-hidden="true"
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: category.color }}
        />
        <span className="truncate">{category.name}</span>
        {category.openTaskCount > 0 ? (
          <span className="ml-auto shrink-0 text-xs tabular-nums text-muted-foreground">
            {category.openTaskCount}
          </span>
        ) : null}
      </Link>

      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-6 w-6 shrink-0 opacity-0 focus-visible:opacity-100 group-hover/category:opacity-100",
              menuOpen && "opacity-100",
            )}
            aria-label={`Category options for ${category.name}`}
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-40">
          <DropdownMenuItem onSelect={() => setEditing(true)}>
            <Pencil className="mr-2 h-4 w-4" />
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onSelect={() => setDeleting(true)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <CategoryDialog
        open={editing}
        onOpenChange={setEditing}
        category={category}
      />
      <CategoryDeleteDialog
        open={deleting}
        onOpenChange={setDeleting}
        category={category}
      />
    </div>
  );
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const options = [
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
    { value: "system", label: "System", icon: Monitor },
  ] as const;

  return (
    <div className="flex items-center gap-0.5 rounded-md border border-border p-0.5">
      {options.map((option) => {
        const Icon = option.icon;
        const active = theme === option.value;
        return (
          <Tooltip key={option.value}>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label={`${option.label} theme`}
                aria-pressed={active}
                onClick={() => setTheme(option.value)}
                className={cn(
                  "grid h-7 w-7 place-items-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
                  active && "bg-accent text-foreground",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent>{option.label}</TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}

export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { categories, counts } = useAppData();
  const pathname = usePathname();
  const [creating, setCreating] = useState(false);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2.5 px-4 py-4">
        <span className="grid h-7 w-7 place-items-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
          K
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-none tracking-tight">Kairos</p>
          <p className="mt-0.5 text-[11px] leading-none text-muted-foreground">
            Personal task manager
          </p>
        </div>
      </div>

      <nav aria-label="Views" className="flex flex-col gap-0.5 px-3 pb-2">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;
          const count = counts[item.countKey];
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground",
                active && "bg-sidebar-accent font-medium text-foreground",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{item.label}</span>
              {count > 0 ? (
                <span className="ml-auto shrink-0 text-xs tabular-nums">{count}</span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-2">
        <div className="flex items-center justify-between px-2 pb-1 pt-3">
          <h2 className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Categories
          </h2>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            aria-label="Add category"
            onClick={() => setCreating(true)}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>

        {categories.length === 0 ? (
          <p className="px-2 py-1 text-xs text-muted-foreground">
            No categories yet. Add one to group your tasks.
          </p>
        ) : (
          <div className="flex flex-col gap-0.5">
            {categories.map((category) => (
              <CategoryRow
                key={category.id}
                category={category}
                active={pathname === `/categories/${category.id}`}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={() => setCreating(true)}
          className="mt-1 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
        >
          <Plus className="h-4 w-4" />
          Add category
        </button>
      </div>

      <div className="border-t border-sidebar-border px-3 py-3">
        <div className="flex flex-col gap-0.5">
          <Link
            href="/statistics"
            onClick={onNavigate}
            aria-current={pathname === "/statistics" ? "page" : undefined}
            className={cn(
              "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground",
              pathname === "/statistics" && "bg-sidebar-accent font-medium text-foreground",
            )}
          >
            <ChartNoAxesColumn className="h-4 w-4" />
            Statistics
          </Link>
          <Link
            href="/settings"
            onClick={onNavigate}
            aria-current={pathname === "/settings" ? "page" : undefined}
            className={cn(
              "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground",
              pathname === "/settings" && "bg-sidebar-accent font-medium text-foreground",
            )}
          >
            <Settings className="h-4 w-4" />
            Settings
          </Link>
        </div>
        <div className="mt-3 flex items-center justify-between px-1">
          <span className="text-[11px] text-muted-foreground">Theme</span>
          <ThemeToggle />
        </div>
      </div>

      <CategoryDialog open={creating} onOpenChange={setCreating} />
    </div>
  );
}
