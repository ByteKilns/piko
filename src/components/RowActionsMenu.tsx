"use client";

import type { ReactNode } from "react";

import { MoreVertical } from "lucide-react";

import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

type Props = { children: ReactNode };

// The "⋮" trigger button + content wrapper was identical in every table's
// actions column (ExpenseTable, CategoriesManager) — only the
// DropdownMenuItems inside differed. Those still get passed as children.
export function RowActionsMenu({ children }: Props) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button aria-label="Row actions" className="rounded-md p-1 text-muted-foreground hover:bg-accent" type="button">
          <MoreVertical className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">{children}</DropdownMenuContent>
    </DropdownMenu>
  );
}
