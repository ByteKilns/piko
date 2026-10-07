"use client";

import { useId } from "react";

import { cn } from "@/lib/utils";

export type SegmentedOption<T extends string> = { label: string; value: T };

type Props<T extends string> = {
  className?: string;
  hideLabel?: boolean;
  label: string;
  name?: string;
  onChange: (value: T) => void;
  options: SegmentedOption<T>[];
  value: T;
};

// One-of-n choice drawn as joined square buttons. Native radios underneath,
// so arrow keys, labels and form semantics come for free.
export function Segmented<T extends string>({ className, hideLabel = false, label, name, onChange, options, value }: Props<T>) {
  const id = useId();

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <span className={cn("text-xs text-n-700", hideLabel && "sr-only")} id={`${id}-label`}>
        {label}
      </span>
      <div aria-labelledby={`${id}-label`} className="flex border border-n-400" role="radiogroup">
        {options.map((option) => (
          <label className="relative flex-1 border-l border-n-400 first:border-l-0" key={option.value}>
            <input
              checked={option.value === value}
              className="peer sr-only"
              name={name ?? id}
              onChange={() => onChange(option.value)}
              type="radio"
              value={option.value}
            />
            <span className="grid h-9.5 cursor-pointer place-items-center px-2 text-sm text-n-800 peer-checked:bg-ink peer-checked:font-semibold peer-checked:text-paper peer-focus-visible:outline-2 peer-focus-visible:-outline-offset-2 peer-focus-visible:outline-signal hover:bg-ink/6 peer-checked:hover:bg-ink">
              {option.label}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
