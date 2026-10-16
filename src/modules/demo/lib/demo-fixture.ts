import type {
  budgetItems,
  categories,
  dhukuEntries,
  dhukus,
  expenses,
  fundPlans,
  funds,
  fundTopUps,
  incomes,
  loanPayments,
  loans,
  monthlyBudgets,
  paybacks,
  recurringExpenses,
  savingsDeposits,
  savingsItems,
  savingsPotPlans,
  savingsPots,
} from "@/db/schema";
import { nextMonth, previousMonth } from "@/lib/month-nav";
import { adToBs, bsToAd } from "@/lib/nepali-date";
import { DEFAULT_CATEGORIES } from "@/modules/categories/lib/default-categories";

// The made-up household every demo visitor gets a private copy of: Aarav (the
// visitor) and Sita, who keep their money separate but plan together. It is
// built relative to `today` so it always looks current, in BS months (the
// household's calendar). Nothing here comes from a real household.

export type DemoFixture = {
  budgetItems: (typeof budgetItems.$inferInsert)[];
  categories: (typeof categories.$inferInsert & { id: string })[];
  dhukuEntries: (typeof dhukuEntries.$inferInsert)[];
  dhukus: (typeof dhukus.$inferInsert)[];
  expenses: (typeof expenses.$inferInsert)[];
  fundPlans: (typeof fundPlans.$inferInsert)[];
  funds: (typeof funds.$inferInsert)[];
  fundTopUps: (typeof fundTopUps.$inferInsert)[];
  incomes: (typeof incomes.$inferInsert)[];
  loanPayments: (typeof loanPayments.$inferInsert)[];
  loans: (typeof loans.$inferInsert)[];
  monthlyBudgets: (typeof monthlyBudgets.$inferInsert & { id: string })[];
  paybacks: (typeof paybacks.$inferInsert)[];
  recurringExpenses: (typeof recurringExpenses.$inferInsert)[];
  savingsDeposits: (typeof savingsDeposits.$inferInsert)[];
  savingsItems: (typeof savingsItems.$inferInsert)[];
  savingsPotPlans: (typeof savingsPotPlans.$inferInsert)[];
  savingsPots: (typeof savingsPots.$inferInsert & { id: string })[];
};

export type DemoFixtureInput = {
  aaravId: string;
  householdId: string;
  newId: () => string;
  sitaId: string;
  // "YYYY-MM-DD" (AD), the day the demo starts.
  today: string;
};

type Who = "aarav" | "sita";
type Month = { month: number; year: number };
type Spend = {
  amount: number;
  category: string;
  day: number;
  note: null | string;
  // null = shared.
  owner: null | Who;
  paidBy: Who;
  recurring?: "internet" | "rent";
  // Everyday spending wobbles a little from month to month; bills don't.
  vary?: boolean;
};

const AARAV_PAY = 85000;
const SITA_PAY = 60000;
const HISTORY_MONTHS = 5;
// One per full month, oldest first, so Reports shows a trend.
const MONTH_WOBBLE = [0.96, 1.04, 0.92, 1.08, 1];
// The share of Aarav's can-cut dining line already spent this month, so
// "Safe to spend" has something to show.
const DINING_USED = 0.85;

const MONTHLY_SPENDING: Spend[] = [
  { amount: 18000, category: "Bills", day: 1, note: "Rent", owner: null, paidBy: "aarav", recurring: "rent" },
  { amount: 1500, category: "Internet", day: 2, note: "WiFi", owner: "sita", paidBy: "sita", recurring: "internet" },
  { amount: 3200, category: "Groceries", day: 3, note: "Weekly groceries", owner: null, paidBy: "aarav", vary: true },
  { amount: 1500, category: "Petrol", day: 5, note: "Bike petrol", owner: "aarav", paidBy: "aarav", vary: true },
  { amount: 1200, category: "Dining Out", day: 6, note: "Momo with friends", owner: "aarav", paidBy: "aarav", vary: true },
  { amount: 650, category: "Public Transport", day: 8, note: "Bus and rides", owner: "sita", paidBy: "sita", vary: true },
  { amount: 6000, category: "Family Support", day: 9, note: "Sent home", owner: "sita", paidBy: "sita" },
  { amount: 2600, category: "Groceries", day: 10, note: "Vegetables and milk", owner: null, paidBy: "sita", vary: true },
  { amount: 500, category: "Personal", day: 11, note: "Phone recharge", owner: "aarav", paidBy: "aarav" },
  { amount: 8000, category: "Parents", day: 12, note: "For Ama and Buwa", owner: "aarav", paidBy: "aarav" },
  { amount: 1800, category: "Dates", day: 13, note: "Dinner out", owner: null, paidBy: "aarav", vary: true },
  { amount: 2500, category: "Shopping", day: 14, note: "New kurta", owner: "sita", paidBy: "sita", vary: true },
  { amount: 1500, category: "Petrol", day: 15, note: null, owner: "aarav", paidBy: "aarav", vary: true },
  { amount: 1200, category: "Health/Wellness", day: 16, note: "Pharmacy", owner: "sita", paidBy: "sita", vary: true },
  { amount: 3000, category: "Groceries", day: 18, note: "Weekly groceries", owner: null, paidBy: "aarav", vary: true },
  { amount: 900, category: "Dining Out", day: 19, note: "Lunch with colleagues", owner: "sita", paidBy: "sita", vary: true },
  { amount: 1100, category: "Utilities", day: 20, note: "Electricity", owner: null, paidBy: "sita", vary: true },
  { amount: 800, category: "Entertainment", day: 22, note: "Movie", owner: "aarav", paidBy: "aarav", vary: true },
  { amount: 500, category: "Personal", day: 24, note: "Phone recharge", owner: "sita", paidBy: "sita" },
  { amount: 2700, category: "Groceries", day: 25, note: null, owner: null, paidBy: "sita", vary: true },
  { amount: 1400, category: "Dining Out", day: 27, note: "Pizza night", owner: null, paidBy: "sita", vary: true },
  { amount: 400, category: "Public Transport", day: 28, note: "Ride home", owner: "aarav", paidBy: "aarav", vary: true },
];

const PLAN: { amount: number; category: string; kind: "can_cut" | "essential" | "fixed"; who: Who }[] = [
  { amount: 18000, category: "Bills", kind: "fixed", who: "aarav" },
  { amount: 8000, category: "Parents", kind: "fixed", who: "aarav" },
  { amount: 7000, category: "Groceries", kind: "essential", who: "aarav" },
  { amount: 3500, category: "Petrol", kind: "essential", who: "aarav" },
  { amount: 600, category: "Personal", kind: "essential", who: "aarav" },
  { amount: 500, category: "Public Transport", kind: "essential", who: "aarav" },
  { amount: 3000, category: "Dining Out", kind: "can_cut", who: "aarav" },
  { amount: 2500, category: "Dates", kind: "can_cut", who: "aarav" },
  { amount: 1500, category: "Entertainment", kind: "can_cut", who: "aarav" },
  { amount: 1500, category: "Internet", kind: "fixed", who: "sita" },
  { amount: 6000, category: "Family Support", kind: "fixed", who: "sita" },
  { amount: 1200, category: "Utilities", kind: "fixed", who: "sita" },
  { amount: 6000, category: "Groceries", kind: "essential", who: "sita" },
  { amount: 1000, category: "Public Transport", kind: "essential", who: "sita" },
  { amount: 1500, category: "Health/Wellness", kind: "essential", who: "sita" },
  { amount: 3000, category: "Shopping", kind: "can_cut", who: "sita" },
  { amount: 2000, category: "Dining Out", kind: "can_cut", who: "sita" },
];

function roundTo10(amount: number): number {
  return Math.round(amount / 10) * 10;
}

function monthsBack(from: Month, count: number): Month {
  let month = from;
  for (let i = 0; i < count; i++) month = previousMonth(month.year, month.month);
  return month;
}

function monthsAhead(from: Month, count: number): Month {
  let month = from;
  for (let i = 0; i < count; i++) month = nextMonth(month.year, month.month);
  return month;
}

export function buildDemoFixture({ aaravId, householdId, newId, sitaId, today }: DemoFixtureInput): DemoFixture {
  const memberId = (who: Who) => (who === "aarav" ? aaravId : sitaId);
  const todayBs = adToBs(today);
  const current: Month = { month: todayBs.month, year: todayBs.year };
  // Oldest first; the last one is the month before this one.
  const history = Array.from({ length: HISTORY_MONTHS }, (_, i) => monthsBack(current, HISTORY_MONTHS - i));
  const allMonths = [...history, current];
  const lastMonth = history[HISTORY_MONTHS - 1];
  const twoMonthsAgo = history[HISTORY_MONTHS - 2];
  const threeMonthsAgo = history[HISTORY_MONTHS - 3];
  const on = (month: Month, day: number) => bsToAd(month.year, month.month, day);
  // This month only has what has happened up to today.
  const happened = (month: Month, day: number) => month !== current || day <= todayBs.day;

  const categoryRows = DEFAULT_CATEGORIES.map((c) => ({
    budgetType: c.budgetType,
    groupName: c.group,
    householdId,
    id: newId(),
    name: c.name,
  }));
  const categoryId = (name: string) => {
    const row = categoryRows.find((c) => c.name === name);
    if (!row) throw new Error(`Demo category not found: ${name}`);
    return row.id;
  };

  const rentId = newId();
  const internetId = newId();
  const recurringRows: DemoFixture["recurringExpenses"] = [
    {
      amount: "18000",
      categoryId: categoryId("Bills"),
      householdId,
      icon: "home",
      id: rentId,
      name: "Rent",
      nextDueDate: on(nextMonth(current.year, current.month), 1),
      ownerMemberId: null,
    },
    {
      amount: "1500",
      categoryId: categoryId("Internet"),
      householdId,
      icon: "wifi",
      id: internetId,
      name: "Internet",
      nextDueDate: on(nextMonth(current.year, current.month), 2),
      ownerMemberId: sitaId,
    },
    {
      amount: "12000",
      categoryId: categoryId("Insurance"),
      frequency: "yearly",
      householdId,
      icon: "shield",
      id: newId(),
      name: "Insurance",
      nextDueDate: on(monthsAhead(current, 3), 15),
      ownerMemberId: aaravId,
    },
  ];

  const potId = newId();
  const expenseRows: DemoFixture["expenses"] = [];
  for (const [index, month] of allMonths.entries()) {
    const wobble = MONTH_WOBBLE[index] ?? 1;
    for (const spend of MONTHLY_SPENDING) {
      if (!happened(month, spend.day)) continue;
      // Last month's date night is still owed; the month before's was paid back.
      const payBack = spend.category === "Dates" && (month === lastMonth || month === twoMonthsAgo) ? "900" : null;
      expenseRows.push({
        amount: String(spend.vary ? roundTo10(spend.amount * wobble) : spend.amount),
        categoryId: categoryId(spend.category),
        date: on(month, spend.day),
        householdId,
        id: newId(),
        note: spend.note,
        ownerMemberId: spend.owner ? memberId(spend.owner) : null,
        paidByMemberId: memberId(spend.paidBy),
        payBackAmount: payBack,
        recurringExpenseId: spend.recurring === "rent" ? rentId : spend.recurring === "internet" ? internetId : null,
      });
    }
  }
  expenseRows.push({
    amount: "6500",
    categoryId: categoryId("Health/Wellness"),
    date: on(threeMonthsAgo, 21),
    householdId,
    id: newId(),
    note: "Dental work",
    ownerMemberId: aaravId,
    paidByMemberId: aaravId,
    savingsPotId: potId,
  });
  // Tops Aarav's dining up to DINING_USED of its cap, whatever day it is.
  const diningCap = PLAN.find((line) => line.who === "aarav" && line.category === "Dining Out")?.amount ?? 0;
  const diningSoFar = expenseRows
    .filter((e) => e.categoryId === categoryId("Dining Out") && e.paidByMemberId === aaravId && e.date >= on(current, 1))
    .reduce((sum, e) => sum + Number(e.amount), 0);
  expenseRows.push({
    amount: String(roundTo10(diningCap * DINING_USED - diningSoFar)),
    categoryId: categoryId("Dining Out"),
    date: today,
    householdId,
    id: newId(),
    note: "Birthday dinner",
    ownerMemberId: aaravId,
    paidByMemberId: aaravId,
  });

  const incomeRows: DemoFixture["incomes"] = allMonths.flatMap((month) => [
    { amount: String(AARAV_PAY), householdId, kind: "pay" as const, memberId: aaravId, month: month.month, year: month.year },
    { amount: String(SITA_PAY), householdId, kind: "pay" as const, memberId: sitaId, month: month.month, year: month.year },
  ]);
  incomeRows.push({
    amount: "40000",
    householdId,
    kind: "extra",
    memberId: aaravId,
    month: threeMonthsAgo.month,
    note: "Festival bonus",
    year: threeMonthsAgo.year,
  });

  // Last month's and this month's plans, so Budget has a month to compare with.
  const budgetRows = [lastMonth, current].map((month) => ({ householdId, id: newId(), month: month.month, year: month.year }));
  const budgetItemRows: DemoFixture["budgetItems"] = budgetRows.flatMap((budget) =>
    PLAN.map((line) => ({
      categoryId: categoryId(line.category),
      kind: line.kind,
      monthlyBudgetId: budget.id,
      ownerMemberId: memberId(line.who),
      plannedAmount: String(line.amount),
    })),
  );

  const depositRows: DemoFixture["savingsDeposits"] = [
    { amount: "60000", date: on(history[0], 1), kind: "opening", memberId: null, potId },
    { amount: "600", date: on(threeMonthsAgo, 28), kind: "interest", memberId: null, potId },
    { amount: "650", date: on(lastMonth, 28), kind: "interest", memberId: null, potId },
  ];
  for (const month of allMonths) {
    if (!happened(month, 2)) continue;
    depositRows.push(
      { amount: "10000", date: on(month, 2), kind: "deposit", memberId: aaravId, potId },
      { amount: "6000", date: on(month, 2), kind: "deposit", memberId: sitaId, potId },
    );
  }

  const dhukuId = newId();
  const dhukuMonths = allMonths.slice(1);
  const fundId = newId();
  const loanId = newId();

  return {
    budgetItems: budgetItemRows,
    categories: categoryRows,
    dhukuEntries: dhukuMonths.map((month) => ({ amount: "5000", date: on(month, 1), dhukuId, type: "contribution" as const })),
    dhukus: [
      {
        householdId,
        id: dhukuId,
        interestPerMonth: "200",
        monthlyContribution: "5000",
        name: "Office dhuku",
        note: "Food at each meeting comes from the pot",
        ownerMemberId: aaravId,
        potDeduction: "500",
        startDate: on(dhukuMonths[0], 1),
        totalMembers: 10,
      },
    ],
    expenses: expenseRows,
    fundPlans: [{ fromMonth: threeMonthsAgo.month, fromYear: threeMonthsAgo.year, fundId, monthlyAmount: "3000" }],
    funds: [
      {
        dueMonth: monthsAhead(current, 3).month,
        dueYear: monthsAhead(current, 3).year,
        householdId,
        id: fundId,
        name: "Dashain shopping",
        ownerMemberId: sitaId,
        startMonth: threeMonthsAgo.month,
        startYear: threeMonthsAgo.year,
        target: "25000",
      },
    ],
    fundTopUps: [{ amount: "2000", fundId, month: lastMonth.month, note: "Leftover from last month", year: lastMonth.year }],
    incomes: incomeRows,
    loanPayments: [{ amount: "5000", date: on(twoMonthsAgo, 15), loanId, memberId: aaravId }],
    loans: [
      {
        counterpartyName: "Bikash",
        date: on(history[1], 10),
        direction: "given",
        householdId,
        id: loanId,
        note: "For his bike repair",
        ownerMemberId: aaravId,
        principalAmount: "20000",
      },
    ],
    monthlyBudgets: budgetRows,
    paybacks: [{ amount: "900", date: on(twoMonthsAgo, 20), fromMemberId: sitaId, householdId, note: "For date night", toMemberId: aaravId }],
    recurringExpenses: recurringRows,
    savingsDeposits: depositRows,
    savingsItems: [
      { cost: "120000", name: "New laptop", position: 1, potId },
      { cost: "45000", name: "Pokhara trip", position: 2, potId },
    ],
    savingsPotPlans: [
      { memberId: aaravId, monthlyAmount: "10000", potId },
      { memberId: sitaId, monthlyAmount: "6000", potId },
    ],
    savingsPots: [{ heldByMemberId: aaravId, householdId, id: potId, name: "Home fund", ownerMemberId: null, reserveMinimum: "50000" }],
  };
}
