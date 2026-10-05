"use client";

import { Check, Plus } from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { NAME_MAX_LENGTH } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { CategoryDTO } from "@/types/kairos";

const NONE_VALUE = "__none__";

/**
 * Category picker with inline creation.
 *
 * `onCreate` creates the category on the server and returns it (or `null` when
 * it failed); the new category is selected straight away so tasks can be filed
 * without leaving the form.
 */
export function CategorySelect({
  value,
  onChange,
  categories,
  onCreate,
  disabled,
  disabledHint,
  className,
  id,
  compact = false,
}: {
  value: string | null;
  onChange: (categoryId: string | null) => void;
  categories: readonly CategoryDTO[];
  onCreate?: (name: string) => Promise<CategoryDTO | null>;
  disabled?: boolean;
  disabledHint?: string;
  className?: string;
  id?: string;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  // Enter and blur both fire; only the first one may create the category.
  const submitted = useRef(false);

  const selected = categories.find((category) => category.id === value) ?? null;

  function close(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      setCreating(false);
      setDraft("");
    }
  }

  async function submitNew() {
    if (submitted.current) return;
    submitted.current = true;

    const name = draft.trim();
    if (!name) {
      setCreating(false);
      setDraft("");
      return;
    }
    if (!onCreate) return;

    setBusy(true);
    const created = await onCreate(name);
    setBusy(false);
    setDraft("");
    setCreating(false);
    if (!created) return;
    onChange(created.id);
    close(false);
  }

  return (
    <Popover open={open} onOpenChange={close}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          id={id}
          disabled={disabled}
          title={disabledHint}
          className={cn(
            "justify-start font-normal",
            compact ? "h-8 px-2 text-xs" : "h-9 w-full",
            className,
          )}
        >
          {selected ? (
            <span
              aria-hidden="true"
              className="mr-2 h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: selected.color }}
            />
          ) : (
            <span aria-hidden="true" className="mr-2 h-2.5 w-2.5 shrink-0 rounded-full border border-muted-foreground/40" />
          )}
          <span className="truncate">{selected ? selected.name : "No category"}</span>
        </Button>
      </PopoverTrigger>

      <PopoverContent align="start" className="w-60 p-1">
        {disabled ? (
          <p className="px-2 py-1.5 text-xs text-muted-foreground">
            {disabledHint ?? "Not available here."}
          </p>
        ) : (
          <>
            <button
              type="button"
              role="menuitemradio"
              aria-checked={value === null}
              onClick={() => {
                onChange(null);
                close(false);
              }}
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent"
            >
              <span className="flex-1">No category</span>
              {value === null ? <Check className="h-4 w-4 text-primary" /> : null}
            </button>

            {categories.map((category) => (
              <button
                key={category.id}
                type="button"
                role="menuitemradio"
                aria-checked={category.id === value}
                onClick={() => {
                  onChange(category.id);
                  close(false);
                }}
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent"
              >
                <span
                  aria-hidden="true"
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: category.color }}
                />
                <span className="flex-1 truncate">{category.name}</span>
                {category.id === value ? <Check className="h-4 w-4 text-primary" /> : null}
              </button>
            ))}

            {onCreate ? (
              <div className="mt-1 border-t border-border pt-1">
                {creating ? (
                  <Input
                    autoFocus
                    value={draft}
                    maxLength={NAME_MAX_LENGTH}
                    placeholder="New category name"
                    aria-label="New category name"
                    className={cn("h-8 text-sm", busy && "opacity-60")}
                    disabled={busy}
                    onChange={(event) => setDraft(event.target.value)}
                    onBlur={() => void submitNew()}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        void submitNew();
                      }
                      if (event.key === "Escape") {
                        event.preventDefault();
                        setCreating(false);
                        setDraft("");
                      }
                    }}
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      submitted.current = false;
                      setCreating(true);
                    }}
                    className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    <Plus className="h-4 w-4" />
                    New category
                  </button>
                )}
              </div>
            ) : null}
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}

/** Plain date input: date-only values, no timezone surprises. */
export function DateField({
  id,
  label,
  value,
  onChange,
  hint,
}: {
  id: string;
  label: string;
  value: string | null;
  onChange: (value: string | null) => void;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <Label htmlFor={id}>{label}</Label>
        {value ? (
          <button
            type="button"
            className="text-xs text-muted-foreground underline-offset-2 hover:underline"
            onClick={() => onChange(null)}
          >
            Clear
          </button>
        ) : null}
      </div>
      <Input
        id={id}
        type="date"
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value || null)}
        className="h-9"
      />
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export { NONE_VALUE };
