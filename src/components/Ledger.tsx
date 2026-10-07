import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

// Headline-figure row at the top of most pages: one large lead figure and up
// to three smaller ones. Lays out against the page's @container (set in the
// (app) layout): side by side from 780px, lead on its own row below that.
export function Ledger({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "grid grid-cols-3 border-t-2 border-b border-t-ink border-b-rule @min-[780px]:grid-cols-[minmax(0,1.55fr)_repeat(3,minmax(0,1fr))]",
        className,
      )}
    >
      {children}
    </div>
  );
}

const LEAD =
  "col-span-full border-b border-n-300 pt-4.5 pb-5 @min-[780px]:col-span-1 @min-[780px]:border-b-0 @min-[780px]:pr-7";
// The first small cell sits flush left when the lead wraps onto its own row.
// Below 560px three figures don't fit side by side, so each small cell becomes
// its own row: label and note on the left, the figure on the right.
const SMALL = cn(
  "border-l border-n-300 px-5 pt-4.5 pb-5 [&:nth-child(2)]:border-l-0 [&:nth-child(2)]:pl-0 @min-[780px]:[&:nth-child(2)]:border-l @min-[780px]:[&:nth-child(2)]:pl-5",
  "@max-[559px]:col-span-full @max-[559px]:grid @max-[559px]:grid-cols-[minmax(0,1fr)_auto] @max-[559px]:items-baseline @max-[559px]:gap-x-4 @max-[559px]:gap-y-1 @max-[559px]:border-t @max-[559px]:border-l-0 @max-[559px]:px-0 @max-[559px]:py-3 @max-[559px]:[&:nth-child(2)]:border-t-0",
);

type CellProps = {
  bar?: ReactNode;
  children: ReactNode;
  label: ReactNode;
  lead?: boolean;
  note?: ReactNode;
  onSelect?: () => void;
  selected?: boolean;
};

// One figure in a Ledger. With `onSelect` the cell becomes a filter button and
// `selected` draws the red bar along its top edge.
export function LedgerCell({ bar, children, label, lead = false, note, onSelect, selected = false }: CellProps) {
  const className = cn(
    "relative flex min-w-0 flex-col items-stretch gap-2 text-left",
    lead ? LEAD : SMALL,
    onSelect && "hover:bg-ink/3",
  );
  const content = (
    <>
      {selected && <span aria-hidden className={cn("absolute right-0 -top-0.5 h-1 bg-signal", lead ? "left-0" : "-left-px")} />}
      <span className={cn("micro-label flex items-center gap-2", selected ? "text-ink" : "text-n-600")}>{label}</span>
      <span className={cn(!lead && "mt-3 @max-[559px]:mt-0 @max-[559px]:justify-self-end")}>{children}</span>
      {note && <span className="flex flex-wrap gap-x-3 gap-y-1 text-[13px] text-n-700">{note}</span>}
      {bar && <span className="mt-1">{bar}</span>}
    </>
  );

  if (onSelect) {
    return (
      <button aria-pressed={selected} className={className} onClick={onSelect} type="button">
        {content}
      </button>
    );
  }
  return <div className={className}>{content}</div>;
}
