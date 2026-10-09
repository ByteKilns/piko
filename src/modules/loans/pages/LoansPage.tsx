import { formatShortDate } from "@/lib/date-format";
import { getDateFormatPref } from "@/lib/date-format-cookie";
import { getCurrentMember, getHouseholdMembers } from "@/lib/session";
import { todayISO } from "@/lib/today";
import { listLoanPayments, listLoans } from "@/modules/loans/api/loans.actions";
import { type LoanRowModel, LoansView } from "@/modules/loans/components/LoansView";
import { buildLoanCards, loanOverviewStats } from "@/modules/loans/lib/loan-stats";

export async function LoansPage() {
  const { householdId, memberId } = await getCurrentMember();
  const dateFormat = await getDateFormatPref(householdId);
  const today = todayISO();

  const [members, loanRows, paymentRows] = await Promise.all([
    getHouseholdMembers(householdId),
    listLoans(householdId),
    listLoanPayments(householdId),
  ]);

  const memberById = new Map(members.map((m) => [m.id, m]));
  const payments = paymentRows.map((p) => ({ amount: Number(p.amount), loanId: p.loanId }));
  const loans = buildLoanCards(loanRows, payments, memberById);
  const stats = loanOverviewStats(loans);

  const roleFor = (ownerMemberId: null | string): "me" | "partner" | "shared" =>
    ownerMemberId === null ? "shared" : ownerMemberId === memberId ? "me" : "partner";

  const rows: LoanRowModel[] = loans.map((loan) => {
    let nextLabel: string;
    let nextTone: "default" | "muted" | "negative";
    if (loan.status === "settled") {
      nextLabel = "Settled";
      nextTone = "muted";
    } else if (loan.nextInstallmentDate) {
      nextLabel = `Next ${formatShortDate(loan.nextInstallmentDate, dateFormat)}${loan.installmentAmount !== null ? ` · Rs ${Math.round(loan.installmentAmount).toLocaleString("en-US")}` : ""}`;
      nextTone = loan.nextInstallmentDate < today ? "negative" : "default";
    } else if (loan.dueDate) {
      nextLabel = `Due ${formatShortDate(loan.dueDate, dateFormat)}`;
      nextTone = loan.dueDate < today ? "negative" : "default";
    } else {
      nextLabel = "—";
      nextTone = "muted";
    }

    return {
      active: loan.status === "active",
      counterpartyName: loan.counterpartyName,
      direction: loan.direction,
      editing: {
        counterpartyName: loan.counterpartyName,
        date: loan.date,
        direction: loan.direction,
        dueDate: loan.dueDate,
        id: loan.id,
        installmentAmount: loan.installmentAmount,
        installmentFrequency: loan.installmentFrequency,
        nextInstallmentDate: loan.nextInstallmentDate,
        note: loan.note,
        ownerKey: roleFor(loan.ownerMemberId),
        principalAmount: loan.principalAmount,
      },
      id: loan.id,
      nextLabel,
      nextTone,
      ownerKey: roleFor(loan.ownerMemberId),
      paid: loan.paid,
      payments: paymentRows
        .filter((p) => p.loanId === loan.id)
        .map((p) => ({ amount: Number(p.amount), dateLabel: formatShortDate(p.date, dateFormat), id: p.id, note: p.note })),
      pct: loan.pct,
      principal: loan.principalAmount,
    };
  });

  return (
    <LoansView
      currentMemberId={memberId}
      ledger={{
        borrowed: stats.totalTaken,
        lent: stats.totalGiven,
        owe: stats.outstandingToPay,
        owed: stats.outstandingToReceive,
        owedRatio: stats.totalGiven > 0 ? (stats.totalGiven - stats.outstandingToReceive) / stats.totalGiven : 0,
      }}
      members={members.map((m) => ({ id: m.id, name: m.user.name }))}
      rows={rows}
    />
  );
}
