"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Money } from "@/components/Money";
import { TextField } from "@/components/TextField";
import { Button } from "@/components/ui/button";
import { formatMoney, sanitizeAmountInput } from "@/lib/money";
import { cn } from "@/lib/utils";
import { settleMonthAction } from "@/modules/cushion/api/cushion.actions";

export type SettleOptions = {
  funds: { id: string; name: string }[];
  loans: { id: string; name: string; owed: number }[];
  pots: { id: string; name: string }[];
};

type Props = SettleOptions & {
  // What was left of the month: negative when it went over.
  amount: number;
  // Only the person whose month it is can decide (not someone viewing as them).
  canSettle: boolean;
  month: number;
  monthLabel: string;
  year: number;
};

// Home's card for last month's leftover: split it between savings, funds and
// loans, and the rest is kept as cushion. A month that went over is taken from
// the cushion once acknowledged.
export function SettleCard({ amount, canSettle, funds, loans, month, monthLabel, pots, year }: Props) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);

  const value = (key: string) => Number(values[key]) || 0;
  const assigned = [...pots.map((p) => `pot:${p.id}`), ...funds.map((f) => `fund:${f.id}`), ...loans.map((l) => `loan:${l.id}`)].reduce(
    (sum, key) => sum + value(key),
    0,
  );
  const kept = Math.round((amount - assigned) * 100) / 100;
  const over = amount < 0;

  async function settle() {
    setPending(true);
    try {
      await settleMonthAction({
        month,
        parts: {
          cushion: over ? amount : kept,
          funds: over ? [] : funds.map((f) => ({ amount: value(`fund:${f.id}`), fundId: f.id })),
          loans: over ? [] : loans.map((l) => ({ amount: value(`loan:${l.id}`), loanId: l.id })),
          savings: over ? [] : pots.map((p) => ({ amount: value(`pot:${p.id}`), potId: p.id })),
        },
        year,
      });
      toast.success(`${monthLabel} decided`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setPending(false);
    }
  }

  const field = (key: string, label: string) => (
    <TextField
      inputMode="decimal"
      key={key}
      label={label}
      onChange={(event) => setValues((prev) => ({ ...prev, [key]: sanitizeAmountInput(event.target.value) }))}
      placeholder="0"
      value={values[key] ?? ""}
    />
  );

  return (
    <section aria-label={`${monthLabel} to decide`} className="mb-9 border-t-2 border-ink pt-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-xl leading-tight font-extrabold tracking-[-0.01em]">
          {over ? `${monthLabel} went over` : `${monthLabel}: what was left`}
        </h2>
        <span className={cn("text-xl font-extrabold", over && "text-signal-ink")}>
          <Money tone={over ? "negative" : "default"} value={amount} />
        </span>
      </div>

      {over ? (
        <p className="mt-2 max-w-[60ch] text-[15px] text-n-800">
          Spending and money moved came to {formatMoney(-amount)} more than pay and extra. It comes out of your cushion.
        </p>
      ) : (
        <>
          <p className="mt-2 max-w-[60ch] text-[15px] text-n-800">Put it to work, or keep it as cushion. Whatever you don&apos;t put anywhere is kept.</p>
          {canSettle && (
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 @min-[780px]:grid-cols-3">
              {pots.map((p) => field(`pot:${p.id}`, `Into ${p.name}`))}
              {funds.map((f) => field(`fund:${f.id}`, `Into the ${f.name} fund`))}
              {loans.map((l) => field(`loan:${l.id}`, `Toward ${l.name} (${formatMoney(l.owed)} owed)`))}
            </div>
          )}
          <p className={cn("mt-3 text-sm", kept < 0 ? "text-signal-ink" : "text-n-700")}>
            {kept < 0 ? `That's ${formatMoney(-kept)} more than was left.` : `Kept as cushion: ${formatMoney(kept)}`}
          </p>
        </>
      )}

      {canSettle ? (
        <Button className="mt-4" disabled={pending || kept < 0} onClick={() => void settle()} type="button">
          {pending ? "Saving..." : over ? "OK, take it from the cushion" : "Done"}
        </Button>
      ) : (
        <p className="mt-3 text-[13px] text-n-600">Only the person whose month it is can decide this.</p>
      )}
    </section>
  );
}
