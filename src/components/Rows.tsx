import type { CSSProperties, ReactNode } from "react";

import { cn } from "@/lib/utils";

// Grid-based table rows. Each page passes its column template per width band
// of the page container — `lg` from 780px, `md` from 560px, `sm` below — and
// hides the cells a band drops itself (e.g. `@max-[559px]:hidden`).
export type RowColumns = { lg: string; md?: string; sm?: string };

function columnStyle({ lg, md, sm }: RowColumns): CSSProperties {
  return { "--cols-lg": lg, "--cols-md": md ?? lg, "--cols-sm": sm ?? md ?? lg } as CSSProperties;
}

const GRID =
  "grid gap-x-4 [grid-template-columns:var(--cols-sm)] @min-[560px]:[grid-template-columns:var(--cols-md)] @min-[780px]:[grid-template-columns:var(--cols-lg)]";

export function RowsHeader({ children, columns }: { children: ReactNode; columns: RowColumns }) {
  return (
    <div className={cn(GRID, "micro-label border-b-2 border-rule px-2 pb-2.5 text-n-600")} style={columnStyle(columns)}>
      {children}
    </div>
  );
}

// A group's heading row (a day, a person, …). The first group sits closer to
// the column header than the ones after it.
export function RowGroupHead({ children, columns, first = false }: { children: ReactNode; columns: RowColumns; first?: boolean }) {
  return (
    <div
      className={cn(GRID, "items-baseline border-b border-rule px-2 pb-2.5", first ? "pt-4.5" : "pt-9")}
      style={columnStyle(columns)}
    >
      {children}
    </div>
  );
}

export function GroupLabel({ className, label, sub }: { className?: string; label: ReactNode; sub?: ReactNode }) {
  return (
    <div className={cn("flex min-w-0 items-baseline gap-2.5", className)}>
      <span className="text-[15px] font-semibold whitespace-nowrap">{label}</span>
      {sub && <span className="truncate text-[13px] text-n-600">{sub}</span>}
    </div>
  );
}

type RowProps = { children: ReactNode; className?: string; columns: RowColumns; onClick?: () => void };

// Clicking a row is a mouse shortcut for its main action; keyboard users get
// the same action from the row's ⋯ menu or a button inside the row.
export function Row({ children, className, columns, onClick }: RowProps) {
  return (
    <div
      className={cn(GRID, "relative items-center border-b border-n-300 px-2 py-3", onClick && "cursor-pointer hover:bg-ink/3", className)}
      data-slot="row"
      onClick={onClick}
      style={columnStyle(columns)}
    >
      {children}
    </div>
  );
}
