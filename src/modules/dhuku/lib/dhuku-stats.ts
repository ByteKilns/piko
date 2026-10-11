// src/modules/dhuku/lib/dhuku-stats.ts
export type DhukuEntryType = "contribution" | "fine" | "payout";
export type DhukuStatus = "active" | "completed";

export type DhukuRow = {
  id: string;
  interestPerMonth: null | string;
  monthlyContribution: string;
  name: string;
  note: null | string;
  ownerMemberId: null | string;
  startDate: string;
  totalMembers: number;
};

export type EntryRow = {
  amount: string;
  date: string;
  dhukuId: string;
  id: string;
  note: null | string;
  type: DhukuEntryType;
};

export type DhukuCardData = {
  expectedNextAmount: number;
  hasTaken: boolean;
  id: string;
  interestPerMonth: null | number;
  monthlyContribution: number;
  monthsLogged: number;
  name: string;
  nextDueDate: null | string;
  note: null | string;
  ownerMemberId: null | string;
  ownerName: null | string;
  startDate: string;
  status: DhukuStatus;
  totalContributed: number;
  totalMembers: number;
  totalReceived: number;
};

// A month counts once its contribution is logged. Payouts and fines never add
// a month, the same as the Dhuku page counts them.
export function monthsLogged(entries: Pick<EntryRow, "type">[]): number {
  return entries.filter((e) => e.type === "contribution").length;
}

export function hasTakenPayout(entries: Pick<EntryRow, "type">[]): boolean {
  return entries.some((e) => e.type === "payout");
}

export function totalContributed(entries: Pick<EntryRow, "amount" | "type">[]): number {
  return entries.filter((e) => e.type === "contribution").reduce((s, e) => s + Number(e.amount), 0);
}

export function totalReceived(entries: Pick<EntryRow, "amount" | "type">[]): number {
  return entries.filter((e) => e.type === "payout").reduce((s, e) => s + Number(e.amount), 0);
}

export function expectedNextAmount(
  monthlyContribution: number,
  interestPerMonth: null | number,
  entries: Pick<EntryRow, "type">[],
): number {
  return hasTakenPayout(entries) ? monthlyContribution + (interestPerMonth ?? 0) : monthlyContribution;
}

export function cycleStatus(totalMembers: number, entries: Pick<EntryRow, "type">[]): DhukuStatus {
  return monthsLogged(entries) >= totalMembers ? "completed" : "active";
}

// Each logged entry represents one member's month, in order — the next
// entry is due one calendar month after the last one, starting from
// startDate. Deliberately independent of today's date: due dates track
// what's actually been logged, not calendar drift, so a late entry doesn't
// throw off every later one.
export function nextEntryDueDate(startDate: string, entries: Pick<EntryRow, "type">[]): string {
  const due = new Date(`${startDate}T00:00:00`);
  due.setMonth(due.getMonth() + monthsLogged(entries));
  // Build the YYYY-MM-DD string from local date parts rather than
  // toISOString() — the Date above was parsed in local time, and
  // toISOString() converts to UTC, which silently shifts the date back a
  // day in any timezone ahead of UTC (e.g. UTC+5:45).
  const year = due.getFullYear();
  const month = String(due.getMonth() + 1).padStart(2, "0");
  const day = String(due.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function buildDhukuCards(
  dhukuRows: DhukuRow[],
  entryRows: EntryRow[],
  memberById: Map<string, { user: { name: string } }>,
): DhukuCardData[] {
  return dhukuRows.map((d) => {
    const entries = entryRows.filter((e) => e.dhukuId === d.id);
    const monthlyContribution = Number(d.monthlyContribution);
    const interestPerMonth = d.interestPerMonth === null ? null : Number(d.interestPerMonth);
    const owner = d.ownerMemberId ? memberById.get(d.ownerMemberId) : null;
    const status = cycleStatus(d.totalMembers, entries);

    return {
      expectedNextAmount: expectedNextAmount(monthlyContribution, interestPerMonth, entries),
      hasTaken: hasTakenPayout(entries),
      id: d.id,
      interestPerMonth,
      monthlyContribution,
      monthsLogged: monthsLogged(entries),
      name: d.name,
      nextDueDate: status === "completed" ? null : nextEntryDueDate(d.startDate, entries),
      note: d.note,
      ownerMemberId: d.ownerMemberId,
      ownerName: owner?.user.name ?? null,
      startDate: d.startDate,
      status,
      totalContributed: totalContributed(entries),
      totalMembers: d.totalMembers,
      totalReceived: totalReceived(entries),
    };
  });
}

export type DhukuOverviewStats = {
  activeCount: number;
  dueThisMonth: number;
  totalContributed: number;
  totalReceived: number;
};

export function dhukuOverviewStats(cards: DhukuCardData[]): DhukuOverviewStats {
  const active = cards.filter((c) => c.status === "active");
  return {
    activeCount: active.length,
    dueThisMonth: active.reduce((s, c) => s + c.expectedNextAmount, 0),
    totalContributed: cards.reduce((s, c) => s + c.totalContributed, 0),
    totalReceived: cards.reduce((s, c) => s + c.totalReceived, 0),
  };
}
