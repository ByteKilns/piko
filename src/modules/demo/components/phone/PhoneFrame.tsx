import type { ReactNode } from "react";

import { BatteryFull, Signal, Wifi } from "lucide-react";

// A phone drawn in CSS on wide screens. On a narrow screen (a real phone) the
// frame would be silly, so the screens simply fill it.
export function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-paper text-ink xl:h-[min(820px,calc(100vh-96px))] xl:w-98 xl:flex-none xl:rounded-[44px] xl:border-[10px] xl:border-ink xl:shadow-dialog">
      <div aria-hidden className="hidden h-8 shrink-0 items-center justify-between px-7 text-xs font-semibold xl:flex">
        <span>9:41</span>
        <span className="absolute top-0 left-1/2 h-6 w-28 -translate-x-1/2 rounded-b-2xl bg-ink" />
        <span className="flex items-center gap-1">
          <Signal className="size-3.5" />
          <Wifi className="size-3.5" />
          <BatteryFull className="size-4" />
        </span>
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}
