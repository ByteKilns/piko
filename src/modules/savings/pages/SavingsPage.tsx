import { formatShortDate } from "@/lib/date-format";
import { getDateFormatPref } from "@/lib/date-format-cookie";
import { formatMoney } from "@/lib/money";
import { currentPeriodYearMonth, formatPeriodLabel, resolvePeriod } from "@/lib/month-period";
import { getCurrentMember, getHouseholdMembers } from "@/lib/session";
import { listCategories } from "@/modules/categories/api/categories";
import {
  listSavingsDeposits,
  listSavingsExpenses,
  listSavingsItems,
  listSavingsPotPlans,
  listSavingsPots,
} from "@/modules/savings/api/savings.actions";
import { type PotOwnerKey, type SavingsPotModel, SavingsView } from "@/modules/savings/components/SavingsView";
import {
  forecastPot,
  monthAfter,
  monthsBetween,
  type NeededByCheck,
  neededByCheck,
  periodOfDate,
  type WhatIfFirst,
  whatIfFirst,
} from "@/modules/savings/lib/savings-forecast";
import { potBalance, putInBetween } from "@/modules/savings/lib/savings-math";

const DEPOSITS_SHOWN = 5;
// Shared pot first, then mine, then my partner's.
const POT_ORDER: Record<PotOwnerKey, number> = { me: 1, partner: 2, shared: 0 };

export async function SavingsPage() {
  const { householdId, memberId } = await getCurrentMember();
  const dateFormat = await getDateFormatPref(householdId);
  const current = currentPeriodYearMonth(dateFormat);
  const period = resolvePeriod(current.year, current.month, dateFormat);

  const [members, categories, potRows, planRows, itemRows, depositRows, spendRows] = await Promise.all([
    getHouseholdMembers(householdId),
    listCategories(householdId),
    listSavingsPots(householdId),
    listSavingsPotPlans(householdId),
    listSavingsItems(householdId),
    listSavingsDeposits(householdId),
    listSavingsExpenses(householdId),
  ]);

  const partner = members.find((m) => m.id !== memberId) ?? null;
  const nameOf = (id: null | string) => members.find((m) => m.id === id)?.user.name ?? null;
  const ownerKeyOf = (ownerMemberId: null | string): PotOwnerKey =>
    ownerMemberId === null ? "shared" : ownerMemberId === memberId ? "me" : "partner";
  const monthLabel = (months: number) => {
    const when = monthAfter(current.year, current.month, months);
    return formatPeriodLabel(when.year, when.month, dateFormat);
  };
  const affordableText = (months: null | number) =>
    months === null ? "Not on the current plan" : months === 0 ? "Affordable now" : `In ${monthLabel(months)}`;

  const deposits = depositRows.map((d) => ({ amount: Number(d.amount), date: d.date, id: d.id, kind: d.kind, memberId: d.memberId, potId: d.potId }));
  const spends = spendRows.flatMap((e) =>
    e.savingsPotId ? [{ amount: Number(e.amount), savingsItemId: e.savingsItemId, savingsPotId: e.savingsPotId }] : [],
  );
  const paidByItem = new Map<string, number>();
  for (const spend of spends) {
    if (spend.savingsItemId) paidByItem.set(spend.savingsItemId, (paidByItem.get(spend.savingsItemId) ?? 0) + spend.amount);
  }

  const pots: SavingsPotModel[] = potRows
    .map((pot) => {
      const balance = potBalance(pot.id, deposits, spends);
      const reserveMinimum = Number(pot.reserveMinimum);
      const plans = planRows.filter((p) => p.potId === pot.id).map((p) => ({ memberId: p.memberId, monthlyAmount: Number(p.monthlyAmount) }));
      const planned = plans.reduce((sum, p) => sum + p.monthlyAmount, 0);
      const potItems = itemRows.filter((i) => i.potId === pot.id);
      const open = potItems.filter((i) => !paidByItem.has(i.id));
      const forecastInput = {
        balance,
        items: open.map((i) => ({ cost: Number(i.cost), id: i.id })),
        monthlyInflow: planned,
        reserveMinimum,
      };
      const forecast = forecastPot(forecastInput);
      const itemName = (id: string) => open.find((i) => i.id === id)?.name ?? "an item";

      // "If you did this first: affordable in Baisakh 2084, pushing Surgery back 4 months."
      const whatIfText = (ifFirst: WhatIfFirst): null | string => {
        if (ifFirst.monthsFromNow === null) return null;
        const when = ifFirst.monthsFromNow === 0 ? "now" : `in ${monthLabel(ifFirst.monthsFromNow)}`;
        const pushes = ifFirst.delays.map((d) => `${itemName(d.id)} back ${d.months} ${d.months === 1 ? "month" : "months"}`).join(", ");
        return `If you did this first: affordable ${when}${pushes ? `, pushing ${pushes}` : ""}.`;
      };
      // "Needed by Chaitra 2083: 2 months late. Add Rs 1,667 a month to make it, or move it up the list."
      const lateText = (check: NeededByCheck, needed: { month: number; year: number }) => {
        const how = check.monthsLate === null ? "not on the current plan" : `${check.monthsLate} ${check.monthsLate === 1 ? "month" : "months"} late`;
        return `Needed by ${formatPeriodLabel(needed.year, needed.month, dateFormat)}: ${how}. Add ${formatMoney(check.extraPerMonth)} a month to make it, or move it up the list.`;
      };

      const toGo = reserveMinimum - balance;
      const reserveNote =
        reserveMinimum <= 0
          ? "No reserve set"
          : toGo <= 0
            ? "Full"
            : forecast.reserveFullInMonths === null
              ? `${formatMoney(toGo)} to go`
              : `${formatMoney(toGo)} to go, full ${forecast.reserveFullInMonths === 0 ? "now" : `in ${monthLabel(forecast.reserveFullInMonths)}`}`;
      return {
        balance,
        deposits: deposits
          .filter((d) => d.potId === pot.id)
          .slice(0, DEPOSITS_SHOWN)
          .map((d) => ({
            amount: d.amount,
            byLabel: d.kind === "opening" ? "Opening balance" : d.kind === "interest" ? "Bank interest" : (nameOf(d.memberId) ?? "Former member"),
            dateLabel: formatShortDate(d.date, dateFormat),
            id: d.id,
          })),
        done: potItems.filter((i) => paidByItem.has(i.id)).map((i) => ({ id: i.id, name: i.name, paid: paidByItem.get(i.id) ?? 0 })),
        heldByMemberId: pot.heldByMemberId,
        id: pot.id,
        items: open.map((i, index) => {
          const itemForecast = forecast.items[index];
          const neededPeriod = i.neededBy ? periodOfDate(i.neededBy, dateFormat) : null;
          const late = neededPeriod
            ? neededByCheck({
                balance,
                cumulativeCost: itemForecast.cumulativeCost,
                monthlyInflow: planned,
                monthsFromNow: itemForecast.monthsFromNow,
                monthsUntilNeeded: monthsBetween(current, neededPeriod),
                reserveMinimum,
              })
            : null;
          const ifFirst = whatIfFirst(forecastInput, i.id);
          return {
            affordable: affordableText(itemForecast.monthsFromNow),
            cost: Number(i.cost),
            hint: ifFirst ? whatIfText(ifFirst) : null,
            id: i.id,
            name: i.name,
            neededBy: i.neededBy,
            note: i.note,
            warning: late && neededPeriod ? lateText(late, neededPeriod) : null,
          };
        }),
        name: pot.name,
        ownerKey: ownerKeyOf(pot.ownerMemberId),
        ownerMemberId: pot.ownerMemberId,
        planned,
        plans,
        putIn: putInBetween(pot.id, deposits, period.startDate, period.endDate),
        reserveMinimum,
        reserveNote,
      };
    })
    .sort((a, b) => POT_ORDER[a.ownerKey] - POT_ORDER[b.ownerKey]);

  const existing = new Set(pots.map((pot) => pot.ownerKey));
  const possible: PotOwnerKey[] = partner ? ["shared", "me", "partner"] : ["shared", "me"];

  return (
    <SavingsView
      categories={categories.map((c) => ({ groupName: c.groupName, id: c.id, name: c.name }))}
      currentMemberId={memberId}
      members={members.map((m) => ({ id: m.id, name: m.user.name }))}
      missing={possible.filter((key) => !existing.has(key))}
      pots={pots}
    />
  );
}
