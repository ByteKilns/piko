import type { ReactNode } from "react";

import { BatteryFull, Signal, Wifi } from "lucide-react";

// A Pixel-shaped phone drawn in CSS: a slim bezel, a centred punch-hole camera,
// Android's status bar and the gesture pill at the bottom. Shown in a modal
// over the website (see DemoPhone).
export function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex h-[min(768px,80vh)] aspect-[9/20] flex-col overflow-hidden rounded-[34px] border-[9px] border-ink bg-paper text-ink shadow-dialog">
      <div aria-hidden className="relative flex h-7 shrink-0 items-center justify-between px-4 text-[11px] font-semibold">
        <span>9:41</span>
        <span className="absolute top-1.5 left-1/2 size-2.5 -translate-x-1/2 rounded-full bg-ink" />
        <span className="flex items-center gap-1">
          <Signal className="size-3" />
          <Wifi className="size-3" />
          <BatteryFull className="size-3.5" />
        </span>
      </div>
      <div className="min-h-0 flex-1">{children}</div>
      <div aria-hidden className="flex h-5 shrink-0 items-center justify-center">
        <span className="h-1 w-24 rounded-full bg-ink/25" />
      </div>
    </div>
  );
}
