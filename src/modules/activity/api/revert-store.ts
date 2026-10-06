import { and, eq, inArray, isNull } from "drizzle-orm";

import { db } from "@/db/client";
import {
  type ActivityEntityType,
  type ActivityLog,
  type ActivitySnapshot,
  budgetItems,
  categories,
  dhukuEntries,
  dhukus,
  expenses,
  householdMembers,
  households,
  incomes,
  loanPayments,
  loans,
  monthlyBudgets,
  recurringExpenses,
  savingsContributions,
  savingsGoals,
} from "@/db/schema";

import type { RevertContext, RevertOperation } from "../lib/revert/plan";
import { reviveRow, toSnapshot } from "../lib/snapshot";

type Row = ActivitySnapshot;
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

// Loads what exists now and executes a planned operation, for one entity type.
// Every query is scoped to the session's household.
export type RevertStore = {
  apply: (tx: Tx, householdId: string, entityId: string, op: RevertOperation) => Promise<void>;
  load: (householdId: string, entityId: string, entry: ActivityLog) => Promise<RevertContext>;
};

type ChildOps = {
  find: (householdId: string, parentId: string) => Promise<object[]>;
  insert: (tx: Tx, householdId: string, parentId: string, rows: Row[]) => Promise<unknown>;
  kind: string;
};

// Table-specific closures keep Drizzle's types concrete; every one of them is
// scoped to the household (directly, or through the parent table).
type TableOps = {
  children?: ChildOps[];
  extra?: (householdId: string, entry: ActivityLog) => Promise<Record<string, object[]>>;
  find: (householdId: string, id: string, entry: ActivityLog) => Promise<object | undefined>;
  insert: (tx: Tx, householdId: string, row: Row) => Promise<unknown>;
  parentIds?: (householdId: string) => Promise<string[]>;
  remove: (tx: Tx, householdId: string, id: string, op: Extract<RevertOperation, { type: "delete" }>) => Promise<unknown>;
  unpay?: (tx: Tx, householdId: string, id: string, op: Extract<RevertOperation, { type: "unpay" }>) => Promise<unknown>;
  update: (tx: Tx, householdId: string, id: string, set: Row) => Promise<unknown>;
};

async function householdReferences(householdId: string) {
  const [cats, members] = await Promise.all([
    db.select({ id: categories.id }).from(categories).where(eq(categories.householdId, householdId)),
    db.select({ id: householdMembers.id }).from(householdMembers).where(eq(householdMembers.householdId, householdId)),
  ]);
  return { categoryIds: new Set(cats.map((c) => c.id)), memberIds: new Set(members.map((m) => m.id)) };
}

function tableStore(ops: TableOps): RevertStore {
  return {
    async apply(tx, householdId, entityId, op) {
      if (op.type === "update") await ops.update(tx, householdId, entityId, op.set);
      else if (op.type === "delete") await ops.remove(tx, householdId, entityId, op);
      else if (op.type === "unpay" && ops.unpay) await ops.unpay(tx, householdId, entityId, op);
      else if (op.type === "insert") {
        await ops.insert(tx, householdId, op.row);
        for (const child of ops.children ?? []) {
          const rows = op.related[child.kind] ?? [];
          if (rows.length > 0) await child.insert(tx, householdId, entityId, rows);
        }
      } else throw new Error(`Unsupported revert operation: ${op.type}`);
    },
    async load(householdId, entityId, entry) {
      const [row, refs, parentIds, children, extra] = await Promise.all([
        ops.find(householdId, entityId, entry),
        householdReferences(householdId),
        ops.parentIds ? ops.parentIds(householdId) : Promise.resolve([]),
        Promise.all((ops.children ?? []).map(async (c) => [c.kind, await c.find(householdId, entityId)] as const)),
        ops.extra ? ops.extra(householdId, entry) : Promise.resolve({}),
      ]);
      const loaded: Record<string, object[]> = { ...Object.fromEntries(children), ...extra };
      return {
        children: Object.fromEntries(Object.entries(loaded).map(([kind, rows]) => [kind, rows.map((r) => toSnapshot(r))])),
        references: { ...refs, parentIds: new Set(parentIds) },
        row: row ? toSnapshot(row) : null,
      };
    },
  };
}

const goalIdsOf = (householdId: string) => db.select({ id: savingsGoals.id }).from(savingsGoals).where(eq(savingsGoals.householdId, householdId));
const loanIdsOf = (householdId: string) => db.select({ id: loans.id }).from(loans).where(eq(loans.householdId, householdId));
const dhukuIdsOf = (householdId: string) => db.select({ id: dhukus.id }).from(dhukus).where(eq(dhukus.householdId, householdId));
const budgetIdsOf = (householdId: string) =>
  db.select({ id: monthlyBudgets.id }).from(monthlyBudgets).where(eq(monthlyBudgets.householdId, householdId));
const idsOf = async (query: Promise<{ id: string }[]>) => (await query).map((r) => r.id);

// Tables without a householdId are scoped through their parent. The planner
// already blocks a restore whose parent isn't this household's; this repeats
// the check inside the transaction, so the write itself is scoped too.
async function requireParent(found: Promise<unknown[]>) {
  if ((await found).length === 0) throw new Error("Parent not found in this household");
}

const expenseStore = tableStore({
  find: async (h, id) => (await db.select().from(expenses).where(and(eq(expenses.id, id), eq(expenses.householdId, h))))[0],
  insert: async (tx, h, row) => {
    const values = { ...reviveRow(expenses, row), householdId: h };
    // Its recurring bill may have been deleted since; like the FK's
    // "set null", the expense then comes back unlinked.
    if (values.recurringExpenseId) {
      const [bill] = await tx
        .select({ id: recurringExpenses.id })
        .from(recurringExpenses)
        .where(and(eq(recurringExpenses.id, values.recurringExpenseId), eq(recurringExpenses.householdId, h)));
      if (!bill) values.recurringExpenseId = null;
    }
    await tx.insert(expenses).values(values);
  },
  remove: (tx, h, id) => tx.delete(expenses).where(and(eq(expenses.id, id), eq(expenses.householdId, h))),
  update: (tx, h, id, set) =>
    tx
      .update(expenses)
      .set(reviveRow(expenses, set))
      .where(and(eq(expenses.id, id), eq(expenses.householdId, h))),
});

const incomeStore = tableStore({
  find: async (h, id) => (await db.select().from(incomes).where(and(eq(incomes.id, id), eq(incomes.householdId, h))))[0],
  insert: (tx, h, row) => tx.insert(incomes).values({ ...reviveRow(incomes, row), householdId: h }),
  remove: (tx, h, id) => tx.delete(incomes).where(and(eq(incomes.id, id), eq(incomes.householdId, h))),
  update: (tx, h, id, set) =>
    tx
      .update(incomes)
      .set(reviveRow(incomes, set))
      .where(and(eq(incomes.id, id), eq(incomes.householdId, h))),
});

const categoryStore = tableStore({
  find: async (h, id) => (await db.select().from(categories).where(and(eq(categories.id, id), eq(categories.householdId, h))))[0],
  insert: (tx, h, row) => tx.insert(categories).values({ ...reviveRow(categories, row), householdId: h }),
  remove: (tx, h, id) => tx.delete(categories).where(and(eq(categories.id, id), eq(categories.householdId, h))),
  update: (tx, h, id, set) =>
    tx
      .update(categories)
      .set(reviveRow(categories, set))
      .where(and(eq(categories.id, id), eq(categories.householdId, h))),
});

const budgetItemStore = tableStore({
  // A budget line is its category/month: changing the owner deletes the row
  // and inserts another, so the line there now may carry a different id.
  // Prefer the entry's own row if several owners share the category.
  find: async (h, id, entry) => {
    const { categoryId, monthlyBudgetId } = entry.after ?? entry.before ?? {};
    if (typeof categoryId === "string" && typeof monthlyBudgetId === "string") {
      const lines = await db
        .select()
        .from(budgetItems)
        .where(
          and(
            eq(budgetItems.monthlyBudgetId, monthlyBudgetId),
            eq(budgetItems.categoryId, categoryId),
            inArray(budgetItems.monthlyBudgetId, budgetIdsOf(h)),
          ),
        );
      const line = lines.find((l) => l.id === id) ?? lines[0];
      if (line) return line;
    }
    return (await db.select().from(budgetItems).where(and(eq(budgetItems.id, id), inArray(budgetItems.monthlyBudgetId, budgetIdsOf(h)))))[0];
  },
  insert: async (tx, h, row) => {
    const values = reviveRow(budgetItems, row);
    await requireParent(
      tx
        .select({ id: monthlyBudgets.id })
        .from(monthlyBudgets)
        .where(and(eq(monthlyBudgets.id, values.monthlyBudgetId), eq(monthlyBudgets.householdId, h))),
    );
    await tx.insert(budgetItems).values(values);
  },
  parentIds: (h) => idsOf(budgetIdsOf(h)),
  remove: (tx, h, id) => tx.delete(budgetItems).where(and(eq(budgetItems.id, id), inArray(budgetItems.monthlyBudgetId, budgetIdsOf(h)))),
  update: (tx, h, id, set) =>
    tx
      .update(budgetItems)
      .set(reviveRow(budgetItems, set))
      .where(and(eq(budgetItems.id, id), inArray(budgetItems.monthlyBudgetId, budgetIdsOf(h)))),
});

const goalStore = tableStore({
  children: [
    {
      find: (h, goalId) =>
        db
          .select()
          .from(savingsContributions)
          .where(and(eq(savingsContributions.goalId, goalId), inArray(savingsContributions.goalId, goalIdsOf(h)))),
      insert: (tx, _h, goalId, rows) => tx.insert(savingsContributions).values(rows.map((r) => ({ ...reviveRow(savingsContributions, r), goalId }))),
      kind: "contributions",
    },
  ],
  find: async (h, id) => (await db.select().from(savingsGoals).where(and(eq(savingsGoals.id, id), eq(savingsGoals.householdId, h))))[0],
  insert: (tx, h, row) => tx.insert(savingsGoals).values({ ...reviveRow(savingsGoals, row), householdId: h }),
  remove: (tx, h, id) => tx.delete(savingsGoals).where(and(eq(savingsGoals.id, id), eq(savingsGoals.householdId, h))),
  update: (tx, h, id, set) =>
    tx
      .update(savingsGoals)
      .set(reviveRow(savingsGoals, set))
      .where(and(eq(savingsGoals.id, id), eq(savingsGoals.householdId, h))),
});

const contributionStore = tableStore({
  find: async (h, id) =>
    (
      await db
        .select()
        .from(savingsContributions)
        .where(and(eq(savingsContributions.id, id), inArray(savingsContributions.goalId, goalIdsOf(h))))
    )[0],
  insert: async (tx, h, row) => {
    const values = reviveRow(savingsContributions, row);
    await requireParent(
      tx
        .select({ id: savingsGoals.id })
        .from(savingsGoals)
        .where(and(eq(savingsGoals.id, values.goalId), eq(savingsGoals.householdId, h))),
    );
    await tx.insert(savingsContributions).values(values);
  },
  parentIds: (h) => idsOf(goalIdsOf(h)),
  remove: (tx, h, id) =>
    tx.delete(savingsContributions).where(and(eq(savingsContributions.id, id), inArray(savingsContributions.goalId, goalIdsOf(h)))),
  update: (tx, h, id, set) =>
    tx
      .update(savingsContributions)
      .set(reviveRow(savingsContributions, set))
      .where(and(eq(savingsContributions.id, id), inArray(savingsContributions.goalId, goalIdsOf(h)))),
});

const loanStore = tableStore({
  children: [
    {
      find: (h, loanId) =>
        db
          .select()
          .from(loanPayments)
          .where(and(eq(loanPayments.loanId, loanId), inArray(loanPayments.loanId, loanIdsOf(h)))),
      insert: (tx, _h, loanId, rows) => tx.insert(loanPayments).values(rows.map((r) => ({ ...reviveRow(loanPayments, r), loanId }))),
      kind: "loanPayments",
    },
  ],
  find: async (h, id) => (await db.select().from(loans).where(and(eq(loans.id, id), eq(loans.householdId, h))))[0],
  insert: (tx, h, row) => tx.insert(loans).values({ ...reviveRow(loans, row), householdId: h }),
  remove: (tx, h, id) => tx.delete(loans).where(and(eq(loans.id, id), eq(loans.householdId, h))),
  update: (tx, h, id, set) =>
    tx
      .update(loans)
      .set(reviveRow(loans, set))
      .where(and(eq(loans.id, id), eq(loans.householdId, h))),
});

const loanPaymentStore = tableStore({
  // The planner rolls the loan's next installment back only if it still
  // matches what this payment advanced it to.
  extra: async (h, entry): Promise<Record<string, object[]>> => {
    const loanId = (entry.after ?? entry.before)?.loanId;
    if (typeof loanId !== "string") return {};
    return { loan: await db.select().from(loans).where(and(eq(loans.id, loanId), eq(loans.householdId, h))) };
  },
  find: async (h, id) =>
    (await db.select().from(loanPayments).where(and(eq(loanPayments.id, id), inArray(loanPayments.loanId, loanIdsOf(h)))))[0],
  insert: async (tx, h, row) => {
    const values = reviveRow(loanPayments, row);
    await requireParent(
      tx
        .select({ id: loans.id })
        .from(loans)
        .where(and(eq(loans.id, values.loanId), eq(loans.householdId, h))),
    );
    await tx.insert(loanPayments).values(values);
  },
  parentIds: (h) => idsOf(loanIdsOf(h)),
  remove: async (tx, h, id, op) => {
    await tx.delete(loanPayments).where(and(eq(loanPayments.id, id), inArray(loanPayments.loanId, loanIdsOf(h))));
    if (op.parentUpdate) {
      await tx
        .update(loans)
        .set(reviveRow(loans, op.parentUpdate.set))
        .where(and(eq(loans.id, op.parentUpdate.id), eq(loans.householdId, h)));
    }
  },
  update: (tx, h, id, set) =>
    tx
      .update(loanPayments)
      .set(reviveRow(loanPayments, set))
      .where(and(eq(loanPayments.id, id), inArray(loanPayments.loanId, loanIdsOf(h)))),
});

const dhukuStore = tableStore({
  children: [
    {
      find: (h, dhukuId) =>
        db
          .select()
          .from(dhukuEntries)
          .where(and(eq(dhukuEntries.dhukuId, dhukuId), inArray(dhukuEntries.dhukuId, dhukuIdsOf(h)))),
      insert: (tx, _h, dhukuId, rows) => tx.insert(dhukuEntries).values(rows.map((r) => ({ ...reviveRow(dhukuEntries, r), dhukuId }))),
      kind: "dhukuEntries",
    },
  ],
  find: async (h, id) => (await db.select().from(dhukus).where(and(eq(dhukus.id, id), eq(dhukus.householdId, h))))[0],
  insert: (tx, h, row) => tx.insert(dhukus).values({ ...reviveRow(dhukus, row), householdId: h }),
  remove: (tx, h, id) => tx.delete(dhukus).where(and(eq(dhukus.id, id), eq(dhukus.householdId, h))),
  update: (tx, h, id, set) =>
    tx
      .update(dhukus)
      .set(reviveRow(dhukus, set))
      .where(and(eq(dhukus.id, id), eq(dhukus.householdId, h))),
});

const dhukuEntryStore = tableStore({
  find: async (h, id) =>
    (await db.select().from(dhukuEntries).where(and(eq(dhukuEntries.id, id), inArray(dhukuEntries.dhukuId, dhukuIdsOf(h)))))[0],
  insert: async (tx, h, row) => {
    const values = reviveRow(dhukuEntries, row);
    await requireParent(
      tx
        .select({ id: dhukus.id })
        .from(dhukus)
        .where(and(eq(dhukus.id, values.dhukuId), eq(dhukus.householdId, h))),
    );
    await tx.insert(dhukuEntries).values(values);
  },
  parentIds: (h) => idsOf(dhukuIdsOf(h)),
  remove: (tx, h, id) => tx.delete(dhukuEntries).where(and(eq(dhukuEntries.id, id), inArray(dhukuEntries.dhukuId, dhukuIdsOf(h)))),
  update: (tx, h, id, set) =>
    tx
      .update(dhukuEntries)
      .set(reviveRow(dhukuEntries, set))
      .where(and(eq(dhukuEntries.id, id), inArray(dhukuEntries.dhukuId, dhukuIdsOf(h)))),
});

const recurringStore = tableStore({
  children: [
    {
      // Deleting a bill only unlinks its expenses (FK "set null"); loading
      // them lets the revert's own log entry re-link them on a redo.
      find: (h, billId) =>
        db
          .select({ id: expenses.id })
          .from(expenses)
          .where(and(eq(expenses.recurringExpenseId, billId), eq(expenses.householdId, h))),
      insert: (tx, h, billId, rows) =>
        tx
          .update(expenses)
          .set({ recurringExpenseId: billId })
          .where(
            and(
              inArray(
                expenses.id,
                rows.map((r) => String(r.id)),
              ),
              eq(expenses.householdId, h),
              isNull(expenses.recurringExpenseId),
            ),
          ),
      kind: "linkedExpenseIds",
    },
  ],
  extra: async (h, entry): Promise<Record<string, object[]>> => {
    const created = entry.related?.createdExpense?.[0]?.id;
    if (entry.action !== "paid" || typeof created !== "string") return {};
    return { createdExpense: await db.select().from(expenses).where(and(eq(expenses.id, created), eq(expenses.householdId, h))) };
  },
  find: async (h, id) =>
    (await db.select().from(recurringExpenses).where(and(eq(recurringExpenses.id, id), eq(recurringExpenses.householdId, h))))[0],
  insert: (tx, h, row) => tx.insert(recurringExpenses).values({ ...reviveRow(recurringExpenses, row), householdId: h }),
  remove: (tx, h, id) => tx.delete(recurringExpenses).where(and(eq(recurringExpenses.id, id), eq(recurringExpenses.householdId, h))),
  unpay: async (tx, h, id, op) => {
    if (op.deleteExpenseId) await tx.delete(expenses).where(and(eq(expenses.id, op.deleteExpenseId), eq(expenses.householdId, h)));
    if (Object.keys(op.set).length > 0) {
      await tx
        .update(recurringExpenses)
        .set(reviveRow(recurringExpenses, op.set))
        .where(and(eq(recurringExpenses.id, id), eq(recurringExpenses.householdId, h)));
    }
  },
  update: (tx, h, id, set) =>
    tx
      .update(recurringExpenses)
      .set(reviveRow(recurringExpenses, set))
      .where(and(eq(recurringExpenses.id, id), eq(recurringExpenses.householdId, h))),
});

const NO_REFERENCES = { categoryIds: new Set<string>(), memberIds: new Set<string>(), parentIds: new Set<string>() };

// Settings live on the household row itself (entityId = householdId). Each
// entry covers one setting, so the live row is narrowed to the keys the entry
// logged — keeping the revert's summary and its own before/after on that one.
const settingsStore: RevertStore = {
  async apply(tx, householdId, entityId, op) {
    if (op.type !== "update" || entityId !== householdId) throw new Error("Unsupported settings revert");
    await tx.update(households).set(reviveRow(households, op.set)).where(eq(households.id, householdId));
  },
  async load(householdId, entityId, entry) {
    const [row] =
      entityId === householdId
        ? await db
            .select({ dateFormat: households.dateFormat })
            .from(households)
            .where(eq(households.id, householdId))
        : [];
    const keys = new Set(Object.keys({ ...entry.before, ...entry.after }));
    const live = row ? Object.fromEntries(Object.entries(toSnapshot(row)).filter(([key]) => keys.has(key))) : null;
    return { children: {}, references: NO_REFERENCES, row: live };
  },
};

export const REVERT_STORES: Partial<Record<ActivityEntityType, RevertStore>> = {
  budget_item: budgetItemStore,
  category: categoryStore,
  dhuku: dhukuStore,
  dhuku_entry: dhukuEntryStore,
  expense: expenseStore,
  household_settings: settingsStore,
  income: incomeStore,
  loan: loanStore,
  loan_payment: loanPaymentStore,
  recurring_expense: recurringStore,
  savings_contribution: contributionStore,
  savings_goal: goalStore,
};
