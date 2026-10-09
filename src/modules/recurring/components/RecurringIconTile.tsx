import { createElement } from "react";

import { cn } from "@/lib/utils";
import { getRecurringIcon } from "@/modules/recurring/lib/recurring-icons";

type Props = { className?: string; icon: string; variant?: "filled" | "outline" };

// 28px square with the recurring item's own icon: filled while it's still to
// pay, outlined once paid or inactive (mirrors CategoryIcon).
export function RecurringIconTile({ className, icon, variant = "filled" }: Props) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid size-7 shrink-0 place-items-center",
        variant === "filled" ? "bg-surface" : "shadow-[inset_0_0_0_1px_var(--n-400)]",
        className,
      )}
    >
      {createElement(getRecurringIcon(icon), { className: "size-3.75 text-ink", strokeWidth: 1.7 })}
    </span>
  );
}
