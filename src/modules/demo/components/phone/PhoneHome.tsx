import { Mic, Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import { RecentExpensesList } from "@/modules/expenses/components/RecentExpensesList";
import type { RecentGroup } from "@/modules/expenses/lib/recent-groups";

// The mobile app's Home: the household's latest expenses by day, and the two
// ways to add one pinned at the bottom.
export function PhoneHome({ onType, onVoice, recent }: { onType: () => void; onVoice: () => void; recent: RecentGroup[] }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-5 pt-3 pb-2">
        <span aria-hidden className="grid size-7 place-items-center bg-ink text-sm font-extrabold text-paper">
          P
        </span>
        <span className="text-base font-extrabold">Piko</span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-2 pb-6">
        <h2 className="text-[28px] leading-tight font-extrabold tracking-[-0.02em]">Recent expenses</h2>
        <p className="mt-1 text-[13px] text-n-600">The latest across the household</p>
        {recent.length === 0 ? (
          <div className="py-8">
            <p className="text-lg font-semibold">No expenses yet.</p>
            <p className="mt-2 text-sm text-n-700">Tap Add by voice and say what you spent.</p>
          </div>
        ) : (
          <div className="mt-5 border-t-2 border-ink">
            <RecentExpensesList groups={recent} />
          </div>
        )}
      </div>

      <div className="flex gap-3 border-t-2 border-rule bg-paper px-5 py-3">
        <Button onClick={onType} type="button" variant="outline">
          <Pencil />
          Type it
        </Button>
        <Button className="flex-1" onClick={onVoice} type="button">
          <Mic />
          Add by voice
        </Button>
      </div>
    </div>
  );
}
