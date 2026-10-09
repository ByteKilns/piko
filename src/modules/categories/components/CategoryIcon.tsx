import { createElement } from "react";

import { cn } from "@/lib/utils";
import { guessCategoryIcon } from "@/modules/categories/lib/guess-category-icon";
import { getRecurringIcon } from "@/modules/recurring/lib/recurring-icons";

type Props = { className?: string; groupName: string; icon?: null | string; name: string; variant?: "filled" | "outline" };

// 28px square with the category's icon: the category's own icon when set,
// otherwise a keyword guess from its name. Filled for money spent, outlined
// for money that's only scheduled (an upcoming bill).
export function CategoryIcon({ className, groupName, icon, name, variant = "filled" }: Props) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid size-7 shrink-0 place-items-center",
        variant === "filled" ? "bg-surface" : "shadow-[inset_0_0_0_1px_var(--n-400)]",
        className,
      )}
    >
      {/* createElement, not <Icon />: the icon is looked up by name, which the
          React Compiler lint can't tell from one built during render. */}
      {createElement(icon ? getRecurringIcon(icon) : guessCategoryIcon(name, groupName), {
        className: "size-3.75 text-ink",
        strokeWidth: 1.7,
      })}
    </span>
  );
}
