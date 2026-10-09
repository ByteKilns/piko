// Pure view logic for the Dhuku page: the month-cell strip and the
// contribution/payout progress derived from a group's entries.

export type DhukuEntryLite = {
  amount: number;
  date: string;
  id: string;
  note: null | string;
  type: "contribution" | "payout";
};

export type DhukuProgress = {
  contributed: number;
  paidCount: number;
  payoutAt: null | number;
  received: number;
};

// A payout doesn't count as a month paid; it marks the month it was taken in.
export function dhukuProgress(entries: DhukuEntryLite[]): DhukuProgress {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  let paidCount = 0;
  let contributed = 0;
  let received = 0;
  let payoutAt: null | number = null;

  for (const entry of sorted) {
    if (entry.type === "payout") {
      received += entry.amount;
      if (payoutAt === null) payoutAt = paidCount;
    } else {
      paidCount += 1;
      contributed += entry.amount;
    }
  }

  return { contributed, paidCount, payoutAt, received };
}

export type DhukuCellState = "next" | "paid" | "payout" | "upcoming";
export type DhukuCell = { state: DhukuCellState; title: string };

export function dhukuMonthCells(months: number, paidCount: number, payoutAt: null | number, completed: boolean): DhukuCell[] {
  return Array.from({ length: months }, (_, i) => {
    const isPay = payoutAt === i;
    const isPaid = i < paidCount;
    const isNext = !completed && i === paidCount;
    const state: DhukuCellState = isPay ? "payout" : isPaid ? "paid" : isNext ? "next" : "upcoming";
    const title = `Month ${i + 1}${isPaid ? " · paid" : ""}${isPay ? " · payout received" : ""}`;
    return { state, title };
  });
}

export function addMonths(dateStr: string, months: number): string {
  const date = new Date(`${dateStr}T00:00:00`);
  date.setMonth(date.getMonth() + months);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
