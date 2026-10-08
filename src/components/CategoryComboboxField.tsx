"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

import { Check, Plus } from "lucide-react";

import { type CategoryMatchInput, hasExactMatch, searchCategories } from "@/components/lib/category-search";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { CategoryFormModal } from "@/modules/categories/components/CategoryFormModal";

type Category = CategoryMatchInput;

type Props = {
  categories: Category[];
  containerClassName?: string;
  error?: string;
  id?: string;
  inputClassName?: string;
  label?: string;
  onCategoriesChange?: (category: Category) => void;
  onValueChange: (value: string) => void;
  placeholder?: string;
  value: string;
};

export function CategoryComboboxField({
  categories,
  containerClassName,
  error,
  id,
  inputClassName,
  label,
  onCategoriesChange,
  onValueChange,
  placeholder = "Search categories...",
  value,
}: Props) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const listboxId = `${fieldId}-listbox`;
  const optionId = (index: number) => `${fieldId}-option-${index}`;
  const anchorRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlighted, setHighlighted] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);

  const selected = categories.find((c) => c.id === value) ?? null;
  const results = useMemo(() => searchCategories(categories, query), [categories, query]);
  const showAddRow = query.trim().length > 0 && !hasExactMatch(categories, query);
  const rowCount = results.length + (showAddRow ? 1 : 0);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resets highlight when query changes or popover opens (including external close via Radix's onOpenChange), not derivable inline from a single event handler
    setHighlighted(0);
  }, [query, open]);

  useEffect(() => {
    if (!open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clears stale typed query on close (including external close via Radix's outside-click/Escape handling), not derivable inline from a single event handler
      setQuery("");
    }
  }, [open]);

  function selectCategory(category: Category) {
    onValueChange(category.id);
    setQuery("");
    setOpen(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "Enter") {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((i) => Math.min(i + 1, Math.max(rowCount - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlighted < results.length) {
        const category = results[highlighted];
        if (category) selectCategory(category);
      } else if (showAddRow) {
        setCreateOpen(true);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  function handleCreated(category: Category) {
    onCategoriesChange?.(category);
    onValueChange(category.id);
    setCreateOpen(false);
    setQuery("");
    setOpen(false);
  }

  return (
    <div className={cn("space-y-1", containerClassName)}>
      {label && <Label htmlFor={fieldId}>{label}</Label>}
      <Popover onOpenChange={setOpen} open={open}>
        <PopoverAnchor asChild>
          <Input
            aria-activedescendant={open && highlighted < rowCount ? optionId(highlighted) : undefined}
            aria-autocomplete="list"
            aria-controls={listboxId}
            aria-expanded={open}
            aria-invalid={Boolean(error)}
            autoComplete="off"
            className={inputClassName}
            id={fieldId}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            ref={anchorRef}
            role="combobox"
            value={open ? query : (selected?.name ?? "")}
          />
        </PopoverAnchor>
        <PopoverContent
          align="start"
          className="max-h-64 w-(--radix-popover-trigger-width) overflow-y-auto p-1"
          id={listboxId}
          // Radix's non-modal Popover only exempts PopoverTrigger from its
          // outside-interaction detection, not PopoverAnchor — so without
          // this, both the pointerdown/focus that OPENS the field and any
          // later click back into it while open get misread as "outside"
          // and immediately close the popover. Exempting our own anchor
          // input here is the fix; every other outside interaction still
          // dismisses normally.
          onInteractOutside={(e) => {
            if (anchorRef.current && e.target instanceof Node && anchorRef.current.contains(e.target)) {
              e.preventDefault();
            }
          }}
          onOpenAutoFocus={(e) => e.preventDefault()}
          role="listbox"
        >
          {results.map((category, index) => (
            <button
              aria-selected={index === highlighted}
              className={cn(
                "flex w-full items-center justify-between gap-1.5 px-2.5 py-1.5 text-left text-sm",
                index === highlighted ? "bg-accent text-accent-foreground" : "hover:bg-accent",
              )}
              id={optionId(index)}
              key={category.id}
              onClick={() => selectCategory(category)}
              onMouseEnter={() => setHighlighted(index)}
              role="option"
              type="button"
            >
              <span>
                {category.name}
                <span className="ml-1.5 text-xs text-muted-foreground">{category.groupName}</span>
              </span>
              {category.id === value && <Check className="h-4 w-4" />}
            </button>
          ))}

          {results.length === 0 && !showAddRow && (
            <p className="px-1.5 py-1 text-sm text-muted-foreground">No categories</p>
          )}

          {showAddRow && (
            <button
              aria-selected={highlighted === results.length}
              className={cn(
                "flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-sm text-primary",
                highlighted === results.length ? "bg-accent" : "hover:bg-accent",
              )}
              id={optionId(results.length)}
              onClick={() => setCreateOpen(true)}
              onMouseEnter={() => setHighlighted(results.length)}
              role="option"
              type="button"
            >
              <Plus className="h-4 w-4" />
              Add &quot;{query.trim()}&quot; as new category
            </button>
          )}
        </PopoverContent>
      </Popover>
      {error && <p className="text-xs text-destructive">{error}</p>}

      <CategoryFormModal
        category={null}
        defaultName={query.trim()}
        onCreated={handleCreated}
        onOpenChange={setCreateOpen}
        open={createOpen}
      />
    </div>
  );
}
