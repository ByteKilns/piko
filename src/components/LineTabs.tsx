"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type LineTab<T extends string> = { count?: number; label: string; value: T };

type Props<T extends string> = {
  aside?: ReactNode;
  className?: string;
  label: string;
  onChange: (value: T) => void;
  tabs: LineTab<T>[];
  value: T;
};

// Text tabs on a 1px rule; the selected one is semibold with a red underline.
export function LineTabs<T extends string>({ aside, className, label, onChange, tabs, value }: Props<T>) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-4 border-b border-n-300", className)}>
      <div aria-label={label} className="flex flex-wrap gap-x-6.5" role="tablist">
        {tabs.map((tab) => {
          const selected = tab.value === value;
          return (
            <button
              aria-selected={selected}
              className={cn(
                "relative inline-flex items-baseline gap-1.5 pt-2 pb-2.75 text-sm",
                selected ? "font-semibold text-ink" : "text-n-700 hover:text-ink",
              )}
              key={tab.value}
              onClick={() => onChange(tab.value)}
              role="tab"
              type="button"
            >
              {tab.label}
              {tab.count !== undefined && <span className="text-xs font-normal text-n-600 tabular-nums">{tab.count}</span>}
              {selected && <span aria-hidden className="absolute inset-x-0 -bottom-px h-0.5 bg-signal" />}
            </button>
          );
        })}
      </div>
      {aside && <div className="pb-2.75 text-[13px] text-n-600">{aside}</div>}
    </div>
  );
}
