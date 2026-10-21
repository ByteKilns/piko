import { getDateFormatPref } from "@/lib/date-format-cookie";
import { resolvePeriod } from "@/lib/month-period";
import { getHouseholdMembers } from "@/lib/session";
import { listIncomeRows } from "@/modules/budget/api/budget";
import { listDhukuEntries, listDhukus } from "@/modules/dhuku/api/dhuku";
import { listExpensesForMonth } from "@/modules/expenses/api/expenses";
import { listFundData } from "@/modules/funds/api/funds";
import { listLoanPayments, listLoans } from "@/modules/loans/api/loans";
import { listSavingsDeposits } from "@/modules/savings/api/savings";

import { personMonthMoney } from "../lib/month-money";

// One person's month, worked out from the database the same way Home does,
// for closing the month on the server.
export async function loadPersonMonthMoney(householdId: string, memberId: string, year: number, month: number) {
  const dateFormat = await getDateFormatPref(householdId);
  const [members, incomeRows, expenses, deposits, dhukus, dhukuEntries, loans, loanPayments, fundData] = await Promise.all([
    getHouseholdMembers(householdId),
    listIncomeRows(householdId),
    listExpensesForMonth(year, month, dateFormat),
    listSavingsDeposits(householdId),
    listDhukus(householdId),
    listDhukuEntries(householdId),
    listLoans(householdId),
    listLoanPayments(householdId),
    listFundData(householdId),
  ]);

  return personMonthMoney({
    deposits: deposits.map((d) => ({ amount: Number(d.amount), date: d.date, kind: d.kind, memberId: d.memberId })),
    dhukuEntries: dhukuEntries.map((e) => ({ amount: Number(e.amount), date: e.date, dhukuId: e.dhukuId, type: e.type })),
    dhukus,
    expenses,
    fundData,
    incomeRows,
    loanPayments: loanPayments.map((p) => ({ amount: Number(p.amount), date: p.date, loanId: p.loanId, memberId: p.memberId })),
    loans,
    memberId,
    memberIds: members.map((m) => m.id),
    month: { month, year },
    period: resolvePeriod(year, month, dateFormat),
  });
}
