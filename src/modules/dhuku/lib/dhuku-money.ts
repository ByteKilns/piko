// What a dhuku really costs you, kept apart from the money that only moves
// between you and the group (your own savings going in, and coming back as the
// pot, or an advance you then repay).

export type DhukuTerms = { monthlyContribution: number; potDeduction: null | number; totalMembers: number };
export type DhukuMoneyEntry = { amount: number; type: "contribution" | "fine" | "payout" };

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

// The pot before any interest: everyone's contribution, less what's taken out
// of every pot (for example the meeting's food).
export function basePot({ monthlyContribution, potDeduction, totalMembers }: DhukuTerms): number {
  return monthlyContribution * totalMembers - (potDeduction ?? 0);
}

// The pot at a given meeting (1-based): the base pot plus the interest every
// member who already took theirs pays on top, one taker per meeting. Fines
// collected at that meeting come on top and aren't known in advance.
export function expectedPot(terms: DhukuTerms, interestPerMonth: null | number, meetingNumber: number): number {
  return basePot(terms) + (interestPerMonth ?? 0) * Math.max(0, meetingNumber - 1);
}

export type DhukuRealCost = { finesPaid: number; foodShare: number; interestPaid: number; received: number; total: number };

// The real cost so far: your share of what's taken out of each pot, the
// interest you paid after taking the pot, and fines, less the interest, fines
// and leftover that came to you inside your pot. Everything else is your own
// money moving in and out, so it isn't a cost.
export function dhukuRealCost(terms: DhukuTerms, entries: DhukuMoneyEntry[]): DhukuRealCost {
  const contributions = entries.filter((e) => e.type === "contribution");
  const contributed = contributions.reduce((sum, e) => sum + e.amount, 0);
  const finesPaid = entries.filter((e) => e.type === "fine").reduce((sum, e) => sum + e.amount, 0);
  const payout = entries.filter((e) => e.type === "payout").reduce((sum, e) => sum + e.amount, 0);
  const foodShare = ((terms.potDeduction ?? 0) / terms.totalMembers) * contributions.length;
  const interestPaid = Math.max(0, contributed - contributions.length * terms.monthlyContribution);
  const received = payout > 0 ? Math.max(0, payout - basePot(terms)) : 0;
  return {
    finesPaid: round(finesPaid),
    foodShare: round(foodShare),
    interestPaid: round(interestPaid),
    received: round(received),
    total: round(foodShare + interestPaid + finesPaid - received),
  };
}

// Where you stand with the group: positive = the group owes you, negative =
// you owe the group. Each contribution puts your own money in (less your food
// share); taking the pot takes the base pot out.
export function dhukuPosition(terms: DhukuTerms, entries: DhukuMoneyEntry[]): number {
  const contributions = entries.filter((e) => e.type === "contribution").length;
  const perContribution = terms.monthlyContribution - (terms.potDeduction ?? 0) / terms.totalMembers;
  const tookPot = entries.some((e) => e.type === "payout");
  return round(contributions * perContribution - (tookPot ? basePot(terms) : 0));
}
