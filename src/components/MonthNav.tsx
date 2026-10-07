"use client";

import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { MonthNavModel } from "@/lib/month-nav";
import { cn } from "@/lib/utils";

const ARROW = "grid size-7.5 place-items-center";

export function MonthNav({ nav }: { nav: MonthNavModel }) {
  return (
    <div className="-ml-1.5 flex items-center gap-0.5">
      <Link aria-label="Previous month" className={cn(ARROW, "text-ink hover:bg-ink/7")} href={nav.prevHref}>
        <ChevronLeft className="size-4" />
      </Link>
      <DropdownMenu>
        <DropdownMenuTrigger className="inline-flex h-7.5 items-center gap-1.5 px-1.5 text-[15px] font-semibold hover:bg-ink/7">
          {nav.label}
          <ChevronDown aria-hidden className="size-3.5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-auto min-w-45 py-1.5">
          {nav.options.map((option) => (
            <DropdownMenuItem asChild key={option.href}>
              <Link aria-current={option.selected ? "page" : undefined} className={cn(option.selected && "font-semibold")} href={option.href}>
                {option.label}
              </Link>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {nav.nextHref ? (
        <Link aria-label="Next month" className={cn(ARROW, "text-ink hover:bg-ink/7")} href={nav.nextHref}>
          <ChevronRight className="size-4" />
        </Link>
      ) : (
        <button aria-label="Next month" className={cn(ARROW, "text-n-400")} disabled title="This is the current month" type="button">
          <ChevronRight className="size-4" />
        </button>
      )}
    </div>
  );
}
