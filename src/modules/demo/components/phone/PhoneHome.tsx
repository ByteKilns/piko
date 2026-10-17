import { Mic, Pencil, Settings } from "lucide-react";

import { Button } from "@/components/ui/button";
import { RecentExpensesList } from "@/modules/expenses/components/RecentExpensesList";
import type { RecentGroup } from "@/modules/expenses/lib/recent-groups";

// The mobile app's Home: the household's latest expenses by day, and the two
// ways to add one pinned at the bottom.
export function PhoneHome({ onSettings, onType, onVoice, recent }: { onSettings: () => void; onType: () => void; onVoice: () => void; recent: RecentGroup[] }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-4 pt-2.5 pb-1.5">
        <span aria-hidden className="grid size-6.5 place-items-center bg-ink text-[13px] font-extrabold text-paper">
          P
        </span>
        <span className="text-[15px] font-extrabold">Piko</span>
        <Button aria-label="Settings" className="ml-auto" onClick={onSettings} size="icon-sm" type="button" variant="ghost">
          <Settings />
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-1 pb-5">
        <h2 className="text-[24px] leading-tight font-extrabold tracking-[-0.02em]">Recent expenses</h2>
        <p className="mt-1 text-[13px] text-n-600">The latest across the household</p>
        {recent.length === 0 ? (
          <div className="py-8">
            <p className="text-lg font-semibold">No expenses yet.</p>
            <p className="mt-2 text-sm text-n-700">Tap Add by voice and say what you spent.</p>
          </div>
        ) : (
          <div className="mt-4 border-t-2 border-ink">
            <RecentExpensesList groups={recent} />
          </div>
        )}
      </div>

      <div className="flex gap-2 border-t-2 border-rule bg-paper px-4 py-2.5">
        <Button className="min-w-0 flex-1" onClick={onType} size="sm" type="button" variant="outline">
          <Pencil className="size-4" />
          Type it
        </Button>
        <Button className="min-w-0 flex-1" onClick={onVoice} size="sm" type="button">
          <Mic className="size-4" />
          Add by voice
        </Button>
      </div>
    </div>
  );
}
