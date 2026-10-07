"use client";

import { type ReactNode, useState } from "react";

import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

type Props = { children: ReactNode; forceOpen?: boolean; label?: string };

// Collapsed section for the fields a dialog's design leaves out but the app
// still needs. `forceOpen` keeps it open while one of those fields has an
// error, so the message is never hidden.
export function MoreDetails({ children, forceOpen = false, label = "More details" }: Props) {
  const [open, setOpen] = useState(false);
  const isOpen = open || forceOpen;

  return (
    <details onToggle={(event) => setOpen(event.currentTarget.open)} open={isOpen}>
      <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 text-[13px] text-n-700 hover:text-ink [&::-webkit-details-marker]:hidden">
        {label}
        <ChevronDown aria-hidden className={cn("size-3.5 transition-transform", isOpen && "rotate-180")} />
      </summary>
      <div className="mt-4.5 flex flex-col gap-5.5">{children}</div>
    </details>
  );
}
