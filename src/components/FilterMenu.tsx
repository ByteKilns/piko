"use client";

import { Check, ChevronDown } from "lucide-react";

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type FilterMenuOption = { count?: number; label: string; value: string };

type Props = {
  active: boolean;
  label: string;
  onSelect: (value: string) => void;
  options: FilterMenuOption[];
  value: null | string;
};

// Plain-text filter dropdown ("Category ▾"). `label` is what the trigger shows
// (the filter's name, or the chosen value once active); the caller decides
// what picking an option means (toggle off, replace, …).
export function FilterMenu({ active, label, onSelect, options, value }: Props) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "inline-flex h-9.5 items-center gap-1.75 px-2.5 text-sm hover:bg-ink/6",
          active ? "font-semibold text-ink" : "text-n-800",
        )}
      >
        {active && <span aria-hidden className="size-1.5 bg-signal" />}
        {label}
        <ChevronDown aria-hidden className="size-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-auto min-w-47.5 py-1.5">
        {options.map((option) => (
          <DropdownMenuItem key={option.value} onSelect={() => onSelect(option.value)}>
            <span className="grid w-3.5 place-items-center text-signal">{option.value === value && <Check className="size-3.5" />}</span>
            <span className="flex-1">{option.label}</span>
            {option.count !== undefined && <span className="text-[13px] text-n-600 tabular-nums">{option.count}</span>}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
