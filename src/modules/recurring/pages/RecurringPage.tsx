import { formatShortDate } from "@/lib/date-format";
import { getDateFormatPref } from "@/lib/date-format-cookie";
import { buildMonthNav, parseMonthParam } from "@/lib/month-nav";
import {
  currentPeriodYearMonth,
  dayNumberInPeriod,
  daysElapsedInPeriod,
  formatPeriodLabel,
  MAX_NAVIGABLE_YEAR,
  MIN_NAVIGABLE_YEAR,
  resolvePeriod,
} from "@/lib/month-period";
import { getCurrentMember, getHouseholdMembers } from "@/lib/session";
import { getIncomesForMonth } from "@/modules/budget/api/budget.actions";
import { listCategories } from "@/modules/categories/api/categories";
import { listExpensesForMonth } from "@/modules/expenses/api/expenses.actions";
import { listRecurringExpenses } from "@/modules/recurring/api/recurring.actions";
import { type RecurringRowModel, RecurringView } from "@/modules/recurring/components/RecurringView";
import { buildRecurringTimeline, dayOfHouseholdCalendar, type TimelineEntry } from "@/modules/recurring/lib/recurring-view";

const FREQUENCY_LABEL = { monthly: "Monthly", yearly: "Yearly" } as const;
const PER_MONTH = { monthly: 1, yearly: 1 / 12 } as const;

function percent(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

function inDaysText(dateStr: string): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(`${dateStr}T00:00:00`);
  const days = Math.round((due.getTime() - today.getTime()) / 86400000);
  if (days === 0) return "today";
  if (days > 0) return `in ${days} ${days === 1 ? "day" : "days"}`;
  return `${Math.abs(days)} ${Math.abs(days) === 1 ? "day" : "days"} late`;
}

type Props = { searchParams: Promise<{ month?: string; year?: string }> };

export async function RecurringPage({ searchParams }: Props) {
  const { householdId, memberId } = await getCurrentMember();
  const dateFormat = await getDateFormatPref(householdId);
  const params = await searchParams;
  const { year: currentYear, month: currentMonth } = currentPeriodYearMonth(dateFormat);
  const year = parseMonthParam(params.year, currentYear, MAX_NAVIGABLE_YEAR[dateFormat], MIN_NAVIGABLE_YEAR[dateFormat]);
  const month = parseMonthParam(params.month, currentMonth, 12);
  const isCurrentMonth = year === currentYear && month === currentMonth;

  const [members, categories, recurringItems, monthExpenses, incomes] = await Promise.all([
    getHouseholdMembers(householdId),
    listCategories(householdId),
    listRecurringExpenses(householdId),
    listExpensesForMonth(year, month, dateFormat),
    getIncomesForMonth(year, month),
  ]);

  const period = resolvePeriod(year, month, dateFormat);
  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const itemById = new Map(recurringItems.map((i) => [i.id, i]));
  const paidExpenses = monthExpenses.filter((e) => e.recurringExpenseId);
  const paidIds = new Set(paidExpenses.map((e) => e.recurringExpenseId));
  const todayDay = isCurrentMonth ? daysElapsedInPeriod(period) : null;

  const roleFor = (ownerMemberId: null | string): "me" | "partner" | "shared" =>
    ownerMemberId === null ? "shared" : ownerMemberId === memberId ? "me" : "partner";

  const rows: RecurringRowModel[] = recurringItems.map((item) => {
    const category = categoryById.get(item.categoryId);
    const paidDate = paidExpenses.find((e) => e.recurringExpenseId === item.id)?.date ?? null;
    const dueDayInPeriod = dayNumberInPeriod(item.nextDueDate, year, month, dateFormat);
    const active = item.status === "active";
    const canPay = active && !paidIds.has(item.id);

    let scheduleText: string;
    let scheduleTone: "default" | "muted" | "negative" = "default";
    if (item.status === "paused") {
      scheduleText = "Paused";
      scheduleTone = "muted";
    } else if (item.status === "completed") {
      scheduleText = "Completed";
      scheduleTone = "muted";
    } else if (paidDate) {
      scheduleText = `Paid ${formatShortDate(paidDate, dateFormat)} · next ${formatShortDate(item.nextDueDate, dateFormat)}`;
      scheduleTone = "muted";
    } else if (todayDay !== null && dueDayInPeriod !== null && dueDayInPeriod < todayDay) {
      scheduleText = `Overdue since ${formatShortDate(item.nextDueDate, dateFormat)}`;
      scheduleTone = "negative";
    } else {
      scheduleText = `Due ${formatShortDate(item.nextDueDate, dateFormat)} · ${inDaysText(item.nextDueDate)}`;
    }

    return {
      amount: Number(item.amount),
      canPay,
      categoryName: category?.name ?? "Unknown",
      editing: {
        amount: Number(item.amount),
        categoryId: item.categoryId,
        dueDay: dayOfHouseholdCalendar(item.nextDueDate, dateFormat),
        endDate: item.endDate,
        frequency: item.frequency,
        icon: item.icon,
        id: item.id,
        name: item.name,
        ownerKey: roleFor(item.ownerMemberId),
        vendor: item.vendor,
      },
      frequency: item.frequency,
      icon: item.icon,
      id: item.id,
      name: item.name,
      ownerKey: roleFor(item.ownerMemberId),
      scheduleText,
      scheduleTone,
      status: item.status,
      sub: [item.vendor, FREQUENCY_LABEL[item.frequency]].filter(Boolean).join(" · "),
    };
  });

  const activeItems = recurringItems.filter((i) => i.status === "active");
  const monthly = activeItems.reduce((sum, i) => sum + Number(i.amount) * PER_MONTH[i.frequency], 0);
  const income = incomes.reduce((sum, i) => sum + Number(i.amount), 0);
  const paidTotal = paidExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const dueItems = activeItems.filter((i) => !paidIds.has(i.id) && dayNumberInPeriod(i.nextDueDate, year, month, dateFormat) !== null);
  const dueTotal = dueItems.reduce((sum, i) => sum + Number(i.amount), 0);
  const totalThisMonth = paidExpenses.length + dueItems.length;
  const nextItem = [...activeItems].sort((a, b) => a.nextDueDate.localeCompare(b.nextDueDate))[0] ?? null;
  const monthName = formatPeriodLabel(year, month, dateFormat).split(" ")[0];

  const entries: TimelineEntry[] = [
    ...dueItems.map((item) => ({
      amount: Number(item.amount),
      day: dayNumberInPeriod(item.nextDueDate, year, month, dateFormat)!,
      name: item.name,
      paid: false,
    })),
    ...paidExpenses.map((expense) => ({
      amount: Number(expense.amount),
      day: dayNumberInPeriod(expense.date, year, month, dateFormat)!,
      name: expense.note ?? itemById.get(expense.recurringExpenseId ?? "")?.name ?? "Payment",
      paid: true,
    })),
  ];
  const timeline = buildRecurringTimeline({ daysInPeriod: period.daysInPeriod, entries, todayDay });

  return (
    <RecurringView
      categories={categories.map((c) => ({ budgetType: c.budgetType, groupName: c.groupName, id: c.id, name: c.name }))}
      currentMemberId={memberId}
      dateFormat={dateFormat}
      daysInPeriod={period.daysInPeriod}
      ledger={{
        due: dueTotal,
        dueSub: dueItems.length ? `${dueItems.length} ${dueItems.length === 1 ? "payment" : "payments"} left this month` : `All paid for ${monthName}`,
        monthly,
        monthlySub: `${activeItems.length} active · ${percent(monthly, income)}% of income`,
        next: nextItem ? formatShortDate(nextItem.nextDueDate, dateFormat) : "—",
        nextSub: nextItem ? `${nextItem.name} · ${inDaysText(nextItem.nextDueDate)}` : "Nothing else due this month",
        paid: paidTotal,
        paidSub: `${paidExpenses.length} of ${totalThisMonth} ${totalThisMonth === 1 ? "payment" : "payments"}`,
      }}
      members={members.map((m) => ({ id: m.id, name: m.user.name }))}
      monthName={monthName}
      monthNav={buildMonthNav({
        basePath: "/recurring",
        current: { month: currentMonth, year: currentYear },
        dateFormat,
        selected: { month, year },
      })}
      rows={rows}
      timeline={timeline}
      todayDay={todayDay}
    />
  );
}
