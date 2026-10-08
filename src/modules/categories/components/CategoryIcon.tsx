import { createElement } from "react";

import { cn } from "@/lib/utils";
import { guessCategoryIcon } from "@/modules/categories/lib/guess-category-icon";

type Props = { className?: string; groupName: string; name: string; variant?: "filled" | "outline" };

// 28px square with the category's icon: filled for money spent, outlined for
// money that's only scheduled (an upcoming bill).
export function CategoryIcon({ className, groupName, name, variant = "filled" }: Props) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid size-7 shrink-0 place-items-center",
        variant === "filled" ? "bg-surface" : "shadow-[inset_0_0_0_1px_var(--n-400)]",
        className,
      )}
    >
      {/* createElement, not <Icon />: the icon is a fixed lucide component looked
          up by name, which the React Compiler lint can't tell from one built
          during render. */}
      {createElement(guessCategoryIcon(name, groupName), { className: "size-3.75 text-ink", strokeWidth: 1.7 })}
    </span>
  );
}
