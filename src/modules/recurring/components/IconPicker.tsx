"use client";

import { createElement } from "react";

import { cn } from "@/lib/utils";
import { getRecurringIcon, RECURRING_ICONS, type RecurringIcon } from "@/modules/recurring/lib/recurring-icons";

type Props = { onChange: (icon: RecurringIcon) => void; value: RecurringIcon };

export function IconPicker({ onChange, value }: Props) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs text-n-700">Icon</p>
      <div className="grid grid-cols-8 gap-1.5">
        {RECURRING_ICONS.map((icon) => {
          const selected = icon === value;
          return (
            <button
              aria-pressed={selected}
              className={cn(
                "grid size-9 place-items-center border",
                selected ? "border-signal bg-surface text-signal-ink" : "border-n-300 text-n-800 hover:border-ink",
              )}
              key={icon}
              onClick={() => onChange(icon)}
              type="button"
            >
              {createElement(getRecurringIcon(icon), { className: "size-4", strokeWidth: 1.7 })}
            </button>
          );
        })}
      </div>
    </div>
  );
}
