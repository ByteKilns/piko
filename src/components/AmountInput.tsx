"use client";

import { type ComponentProps, useId } from "react";

import { sanitizeAmountInput } from "@/lib/money";
import { cn } from "@/lib/utils";

type Props = Omit<ComponentProps<"input">, "size" | "type"> & { error?: string; label: string; size?: "lg" | "xl" };

// The big "Rs ____" field every money dialog leads with. Input is cut down to
// digits and one decimal point (two places) before any onChange sees it, so it
// works the same controlled or registered with react-hook-form.
export function AmountInput({ className, error, id, label, onChange, size = "lg", ...props }: Props) {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs text-n-700" htmlFor={inputId}>
        {label}
      </label>
      <div className="flex items-baseline gap-2 border-b-2 border-ink pb-1.5">
        <span aria-hidden className="text-lg font-semibold text-n-600">
          Rs
        </span>
        <input
          aria-invalid={error ? true : undefined}
          autoComplete="off"
          className={cn(
            "min-w-0 flex-1 border-0 bg-transparent p-0 leading-[1.1] font-extrabold tracking-[-0.02em] text-ink tabular-nums caret-signal outline-none placeholder:text-n-400",
            size === "xl" ? "text-[44px]" : "text-[40px]",
            className,
          )}
          id={inputId}
          inputMode="decimal"
          onChange={(event) => {
            event.target.value = sanitizeAmountInput(event.target.value);
            onChange?.(event);
          }}
          placeholder="0.00"
          type="text"
          {...props}
        />
      </div>
      {error && <p className="text-[13px] text-signal-ink">{error}</p>}
    </div>
  );
}
