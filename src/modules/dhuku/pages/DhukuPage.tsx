import { formatDate } from "@/lib/date-format";
import { getDateFormatPref } from "@/lib/date-format-cookie";
import { currentPeriodYearMonth, formatPeriodLabel, resolvePeriod } from "@/lib/month-period";
import { getCurrentMember, getHouseholdMembers } from "@/lib/session";
import { todayISO } from "@/lib/today";
import { listDhukuEntries, listDhukus } from "@/modules/dhuku/api/dhuku.actions";
import { type DhukuEntryModel, type DhukuRowModel, DhukuView } from "@/modules/dhuku/components/DhukuView";
import { addMonths, dhukuMonthCells, dhukuProgress } from "@/modules/dhuku/lib/dhuku-view";

export async function DhukuPage() {
  const { householdId, memberId } = await getCurrentMember();
  const dateFormat = await getDateFormatPref(householdId);
  const { year, month } = currentPeriodYearMonth(dateFormat);
  const period = resolvePeriod(year, month, dateFormat);
  const today = todayISO();
  const monthName = formatPeriodLabel(year, month, dateFormat).split(" ")[0];

  const [members, dhukuRows, entryRows] = await Promise.all([
    getHouseholdMembers(householdId),
    listDhukus(householdId),
    listDhukuEntries(householdId),
  ]);

  const roleFor = (ownerMemberId: null | string): "me" | "partner" | "shared" =>
    ownerMemberId === null ? "shared" : ownerMemberId === memberId ? "me" : "partner";

  const computed = dhukuRows.map((dhuku) => {
    const rawEntries = entryRows.filter((e) => e.dhukuId === dhuku.id);
    const entriesLite = rawEntries.map((e) => ({ amount: Number(e.amount), date: e.date, id: e.id, note: e.note, type: e.type }));
    const progress = dhukuProgress(entriesLite);
    const months = dhuku.totalMembers;
    const completed = progress.paidCount >= months;
    const active = !completed;
    const monthly = Number(dhuku.monthlyContribution);
    const interest = dhuku.interestPerMonth === null ? null : Number(dhuku.interestPerMonth);
    const nextDueDate = completed ? null : addMonths(dhuku.startDate, progress.paidCount);
    const nextAmount = progress.payoutAt !== null ? monthly + (interest ?? 0) : monthly;
    return { active, completed, dhuku, interest, monthly, months, nextAmount, nextDueDate, progress, rawEntries };
  });

  const rows: DhukuRowModel[] = computed.map(({ active, completed, dhuku, interest, monthly, months, nextAmount, nextDueDate, progress, rawEntries }) => {
    let nextSub: string;
    let nextTone: "default" | "muted" | "negative";
    if (completed || nextDueDate === null) {
      nextSub = "—";
      nextTone = "muted";
    } else if (nextDueDate < today) {
      nextSub = "Overdue — log it if already paid";
      nextTone = "negative";
    } else if (nextDueDate <= period.endDate) {
      nextSub = `Rs ${Math.round(nextAmount).toLocaleString("en-US")} due this month`;
      nextTone = "default";
    } else {
      nextSub = `Rs ${Math.round(nextAmount).toLocaleString("en-US")} upcoming`;
      nextTone = "muted";
    }

    const entries: DhukuEntryModel[] = rawEntries.map((e) => ({
      amount: Number(e.amount),
      dateLabel: formatDate(e.date, dateFormat),
      id: e.id,
      type: e.type,
    }));

    return {
      active,
      cells: dhukuMonthCells(months, progress.paidCount, progress.payoutAt, completed),
      completed,
      contributed: progress.contributed,
      editing: {
        id: dhuku.id,
        interestPerMonth: interest,
        monthlyContribution: monthly,
        name: dhuku.name,
        note: dhuku.note,
        ownerKey: roleFor(dhuku.ownerMemberId),
        startDate: dhuku.startDate,
        totalMembers: months,
      },
      entries,
      id: dhuku.id,
      monthly,
      monthText: completed ? `All ${months} months paid` : `Month ${progress.paidCount + 1} of ${months}`,
      name: dhuku.name,
      nextLabel: completed || nextDueDate === null ? "Completed" : formatDate(nextDueDate, dateFormat),
      nextSub,
      nextTone,
      ownerKey: roleFor(dhuku.ownerMemberId),
      pct: months > 0 ? Math.round((progress.paidCount / months) * 100) : 0,
      pot: monthly * months,
    };
  });

  const due = computed.filter((c) => c.active && c.nextDueDate !== null && c.nextDueDate <= period.endDate);
  const activeCount = computed.filter((c) => c.active).length;
  const completedCount = computed.filter((c) => c.completed).length;
  const contributedTotal = computed.reduce((sum, c) => sum + c.progress.contributed, 0);
  const receivedTotal = computed.reduce((sum, c) => sum + c.progress.received, 0);

  return (
    <DhukuView
      currentMemberId={memberId}
      defaultStartDate={period.startDate}
      ledger={{
        active: String(activeCount),
        activeSub: `${completedCount} completed`,
        contributed: contributedTotal,
        due: due.reduce((sum, c) => sum + c.nextAmount, 0),
        dueSub: due.length > 0 ? due.map((c) => c.dhuku.name).join(", ") : `Nothing due in ${monthName}`,
        received: receivedTotal,
        recvSub: receivedTotal > 0 ? "Payouts taken" : "No payout taken yet",
      }}
      members={members.map((m) => ({ id: m.id, name: m.user.name }))}
      rows={rows}
    />
  );
}
