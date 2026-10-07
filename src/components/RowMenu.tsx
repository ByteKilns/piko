"use client";

import { MoreHorizontal } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type RowMenuItem = { destructive?: boolean; label: string; onSelect: () => void };

// The ⋯ button at the end of a row. Destructive items go below a rule, as in
// the mockups. Clicks are stopped here because React bubbles portal events up
// the component tree — without it, choosing an item would also "click" the
// row (which opens Edit).
export function RowMenu({ items, label = "More actions" }: { items: RowMenuItem[]; label?: string }) {
  const regular = items.filter((item) => !item.destructive);
  const destructive = items.filter((item) => item.destructive);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={label}
        className="grid size-7 place-items-center text-n-500 hover:bg-ink/7 hover:text-ink data-[state=open]:text-ink"
        onClick={(event) => event.stopPropagation()}
      >
        <MoreHorizontal className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-auto min-w-47.5 py-1.5" onClick={(event) => event.stopPropagation()}>
        {regular.map((item) => (
          <DropdownMenuItem key={item.label} onSelect={item.onSelect}>
            {item.label}
          </DropdownMenuItem>
        ))}
        {regular.length > 0 && destructive.length > 0 && <DropdownMenuSeparator className="my-1.5 bg-n-300" />}
        {destructive.map((item) => (
          <DropdownMenuItem key={item.label} onSelect={item.onSelect} variant="destructive">
            {item.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
