import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type Props = { aside?: ReactNode; children: ReactNode; className?: string; rule?: boolean; sub?: ReactNode };

// 20px section title with an optional sub-line and a right-hand slot (a link
// or a short note). The 2px rule underneath is dropped when a table header
// directly below already draws one.
export function SectionHeading({ aside, children, className, rule = true, sub }: Props) {
  return (
    <div className={cn("flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 pb-3", rule && "border-b-2 border-rule", className)}>
      <div className="flex flex-col gap-1">
        <h2 className="text-xl leading-tight font-extrabold tracking-[-0.01em]">{children}</h2>
        {sub && <span className="text-[13px] text-n-600">{sub}</span>}
      </div>
      {aside && <div className="text-[13px] text-n-600">{aside}</div>}
    </div>
  );
}
