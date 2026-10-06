import { describe, expect, it } from "vitest";

import type { ActivitySnapshot } from "@/db/schema";

import { testFormatters } from "../test-formatters";
import { ENTITY_REVERT } from "./entities";
import { isRevertible, planRevert, type RevertableEntry, type RevertContext, revertModes } from "./plan";

const f = testFormatters();

function context(row: ActivitySnapshot | null, extra: Partial<RevertContext> = {}): RevertContext {
  return {
    children: {},
    references: { categoryIds: new Set(["cat-1", "cat-2"]), memberIds: new Set(["m-1", "m-2"]), parentIds: new Set(["l-1"]) },
    row,
    ...extra,
  };
}

function entry(partial: Partial<RevertableEntry> & Pick<RevertableEntry, "action" | "entityType">): RevertableEntry {
  return { after: null, before: null, related: null, ...partial };
}

// The spec's example: 2pm edit amount 500 → 800, 3pm edit changed the note.
const original = { amount: "500.00", categoryId: "cat-1", date: "2026-10-01", id: "e-1", note: "veg", ownerMemberId: null, paidByMemberId: "m-1" };
const after2pm = { ...original, amount: "800.00" };
const now = { ...after2pm, note: "fruit" };
const edit2pm = entry({ action: "updated", after: after2pm, before: original, entityType: "expense" });

describe("planRevert — edits", () => {
  it("undo only this change puts back just the fields that edit changed", () => {
    expect(planRevert(edit2pm, context(now), "undo", f)).toEqual({
      changes: [{ field: "Amount", from: "RS 800", to: "RS 500" }],
      kind: "apply",
      operation: { set: { amount: "500.00" }, type: "update" },
      warnings: [],
    });
  });

  it("restore to before this change also undoes later edits, and says so", () => {
    expect(planRevert(edit2pm, context(now), "restore", f)).toEqual({
      changes: [
        { field: "Amount", from: "RS 800", to: "RS 500" },
        { field: "Note", from: "fruit", to: "veg" },
      ],
      kind: "apply",
      operation: { set: { amount: "500.00", note: "veg" }, type: "update" },
      warnings: ["This also overrides a later change to Note (now fruit)."],
    });
  });

  it("warns when the field it reverts was changed again later", () => {
    const plan = planRevert(edit2pm, context({ ...now, amount: "900.00" }), "undo", f);
    expect(plan.kind === "apply" && plan.warnings).toEqual(["This also overrides a later change to Amount (now RS 900)."]);
  });

  it("is a no-op when already back to how it was", () => {
    expect(planRevert(edit2pm, context({ ...now, amount: "500.00" }), "undo", f)).toEqual({
      kind: "noop",
      reason: "Already back to how it was.",
    });
  });

  describe("compares fields by formatted value, like the log", () => {
    // Note null → "" formats the same (no note), so this edit changed only the amount.
    const blankNote = entry({ action: "updated", after: { ...after2pm, note: "" }, before: { ...original, note: null }, entityType: "expense" });

    it("ignores a representation-only change when undoing", () => {
      expect(planRevert(blankNote, context({ ...after2pm, note: "" }), "undo", f)).toEqual({
        changes: [{ field: "Amount", from: "RS 800", to: "RS 500" }],
        kind: "apply",
        operation: { set: { amount: "500.00" }, type: "update" },
        warnings: [],
      });
    });

    it("is a no-op once the real change is already reverted", () => {
      expect(planRevert(blankNote, context({ ...original, note: "" }), "undo", f)).toEqual({
        kind: "noop",
        reason: "Already back to how it was.",
      });
    });
  });

  it("is blocked when the item was deleted since", () => {
    expect(planRevert(edit2pm, context(null), "undo", f)).toEqual({
      kind: "blocked",
      reason: "This expense has since been deleted — revert that deletion first.",
    });
  });

  it("shows a line for a swapped photo even though both format the same", () => {
    const goal = { description: null, id: "g-1", image: "data:a", name: "Trip", ownerMemberId: null, targetAmount: null, targetDate: null };
    const plan = planRevert(entry({ action: "updated", after: { ...goal, image: "data:b" }, before: goal, entityType: "savings_goal" }), context({ ...goal, image: "data:b" }), "undo", f);
    expect(plan.kind === "apply" && plan.changes).toEqual([{ field: "Photo", from: "Current version", to: "Earlier version" }]);
  });

  it("flips status changes back (category archived)", () => {
    const category = { archived: false, budgetType: "flexible", groupName: "Household", id: "c-1", name: "Groceries" };
    const plan = planRevert(entry({ action: "archived", after: { ...category, archived: true }, before: category, entityType: "category" }), context({ ...category, archived: true }), "undo", f);
    expect(plan.kind === "apply" && [plan.changes, plan.operation]).toEqual([
      [{ field: "Status", from: "Archived", to: "Active" }],
      { set: { archived: false }, type: "update" },
    ]);
  });

  it("restores only the setting the entry touched", () => {
    const plan = planRevert(
      entry({ action: "updated", after: { dateFormat: "english" }, before: { dateFormat: "nepali" }, entityType: "household_settings" }),
      context({ dateFormat: "english", name: "Home" }),
      "restore",
      f,
    );
    expect(plan.kind === "apply" && plan.operation).toEqual({ set: { dateFormat: "nepali" }, type: "update" });
  });
});

describe("planRevert — adds", () => {
  const loan = { counterpartyName: "Hari", date: "2026-09-01", direction: "given", id: "l-1", ownerMemberId: null, principalAmount: "50000.00" };

  it("removes the item and warns about children added since", () => {
    const plan = planRevert(entry({ action: "created", after: loan, entityType: "loan" }), context(loan, { children: { loanPayments: [{}, {}] } }), "undo", f);
    expect(plan.kind === "apply" && [plan.operation, plan.warnings, plan.changes[0]]).toEqual([
      { type: "delete" },
      ["This also removes 2 payments."],
      { field: "Person", from: "Hari", to: null },
    ]);
  });

  it("is a no-op when already removed", () => {
    expect(planRevert(entry({ action: "created", after: loan, entityType: "loan" }), context(null), "undo", f)).toEqual({
      kind: "noop",
      reason: "Already removed.",
    });
  });

  it("rolls a loan's next installment back when removing the payment that advanced it", () => {
    const payment = { amount: "5000.00", date: "2026-09-04", id: "lp-1", loanId: "l-1", memberId: "m-1", note: null };
    const link = { id: "l-1", nextInstallmentDateAfter: "2026-11-01", nextInstallmentDateBefore: "2026-10-01" };
    const created = entry({ action: "created", after: payment, entityType: "loan_payment", related: { loan: [link] } });

    const rolled = planRevert(created, context(payment, { children: { loan: [{ id: "l-1", nextInstallmentDate: "2026-11-01" }] } }), "undo", f);
    expect(rolled.kind === "apply" && rolled.operation).toEqual({ parentUpdate: { id: "l-1", set: { nextInstallmentDate: "2026-10-01" } }, type: "delete" });

    const movedSince = planRevert(created, context(payment, { children: { loan: [{ id: "l-1", nextInstallmentDate: "2026-12-01" }] } }), "undo", f);
    expect(movedSince.kind === "apply" && [movedSince.operation, movedSince.warnings]).toEqual([
      { type: "delete" },
      ["Next installment date was changed since — left as is."],
    ]);
  });
});

describe("planRevert — deletes", () => {
  const loan = { counterpartyName: "Hari", date: "2026-09-01", direction: "given", id: "l-1", ownerMemberId: "m-1", principalAmount: "50000.00" };
  const deleted = entry({ action: "deleted", before: loan, entityType: "loan", related: { loanPayments: [{ id: "p-1" }, { id: "p-2" }] } });

  it("re-creates the item with its children", () => {
    const plan = planRevert(deleted, context(null), "undo", f);
    expect(plan.kind === "apply" && [plan.operation, plan.warnings]).toEqual([
      { related: { loanPayments: [{ id: "p-1" }, { id: "p-2" }] }, row: loan, type: "insert" },
      ["Also brings back 2 payments."],
    ]);
  });

  it("is blocked when it exists again, or a member/category/parent is gone", () => {
    expect(planRevert(deleted, context(loan), "undo", f)).toEqual({ kind: "blocked", reason: "This loan already exists again." });
    const noMember = context(null, { references: { categoryIds: new Set(), memberIds: new Set(), parentIds: new Set() } });
    expect(planRevert(deleted, noMember, "undo", f)).toEqual({ kind: "blocked", reason: "A member it belonged to is no longer in the household." });

    const expense = entry({ action: "deleted", before: { ...original, categoryId: "gone" }, entityType: "expense" });
    expect(planRevert(expense, context(null), "undo", f)).toEqual({ kind: "blocked", reason: "Its category no longer exists." });

    const payment = entry({ action: "deleted", before: { amount: "1.00", id: "lp-1", loanId: "gone", memberId: "m-1" }, entityType: "loan_payment" });
    expect(planRevert(payment, context(null), "undo", f)).toEqual({
      kind: "blocked",
      reason: "The loan it belonged to no longer exists — revert that deletion first.",
    });
  });

  it("is blocked when a budget line's month budget isn't this household's", () => {
    const line = { categoryId: "cat-1", id: "bi-1", monthlyBudgetId: "mb-other", ownerMemberId: null, plannedAmount: "1000.00" };
    const budgetLine = entry({ action: "deleted", before: line, entityType: "budget_item" });
    expect(planRevert(budgetLine, context(null), "undo", f)).toEqual({
      kind: "blocked",
      reason: "The month's budget it belonged to no longer exists — revert that deletion first.",
    });
    const ownBudget = context(null, { references: { categoryIds: new Set(["cat-1"]), memberIds: new Set(), parentIds: new Set(["mb-other"]) } });
    expect(planRevert(budgetLine, ownBudget, "undo", f).kind).toBe("apply");
  });
});

// A budget line's identity is its category/month: changing the owner deletes
// the row and inserts another, so the store loads whatever line that
// category/month has now — which may carry a different id than the entry.
describe("planRevert — budget lines", () => {
  const lineA = { categoryId: "cat-1", id: "bi-A", monthlyBudgetId: "mb-1", ownerMemberId: null, plannedAmount: "5000.00" };
  const budgetContext = (row: ActivitySnapshot | null) =>
    context(row, { references: { categoryIds: new Set(["cat-1"]), memberIds: new Set(["m-1", "m-2"]), parentIds: new Set(["mb-1"]) } });

  it("reverts an edit onto the line that replaced it after an owner switch", () => {
    const edit = entry({ action: "updated", after: { ...lineA, plannedAmount: "4000.00" }, before: lineA, entityType: "budget_item" });
    const lineB = { ...lineA, id: "bi-B", ownerMemberId: "m-1", plannedAmount: "4000.00" };

    expect(planRevert(edit, budgetContext(lineB), "undo", f)).toEqual({
      changes: [{ field: "Planned", from: "RS 4,000", to: "RS 5,000" }],
      kind: "apply",
      operation: { set: { plannedAmount: "5000.00" }, type: "update" },
      warnings: [],
    });
    const restore = planRevert(edit, budgetContext(lineB), "restore", f);
    expect(restore.kind === "apply" && restore.operation).toEqual({ set: { ownerMemberId: null, plannedAmount: "5000.00" }, type: "update" });
  });

  it("restoring a deleted line replaces the one there now instead of adding a second", () => {
    const deleted = entry({ action: "deleted", before: lineA, entityType: "budget_item" });
    const lineC = { ...lineA, id: "bi-C", plannedAmount: "4000.00" };

    expect(planRevert(deleted, budgetContext(lineC), "undo", f)).toEqual({
      changes: [{ field: "Planned", from: "RS 4,000", to: "RS 5,000" }],
      kind: "apply",
      operation: { set: { plannedAmount: "5000.00" }, type: "update" },
      warnings: ["This replaces the budget line that's there now."],
    });
    expect(planRevert(deleted, budgetContext({ ...lineA, id: "bi-C" }), "undo", f)).toEqual({
      kind: "noop",
      reason: "Already back to how it was.",
    });
  });

  it("still checks a replaced line's references", () => {
    const deleted = entry({ action: "deleted", before: { ...lineA, ownerMemberId: "m-gone" }, entityType: "budget_item" });
    expect(planRevert(deleted, budgetContext({ ...lineA, id: "bi-C" }), "undo", f)).toEqual({
      kind: "blocked",
      reason: "A member it belonged to is no longer in the household.",
    });
  });

  it("removing an added line removes the one there now, even after an owner switch", () => {
    const created = entry({ action: "created", after: lineA, entityType: "budget_item" });
    const plan = planRevert(created, budgetContext({ ...lineA, id: "bi-B", ownerMemberId: "m-1" }), "undo", f);
    expect(plan.kind === "apply" && [plan.operation, plan.changes]).toEqual([
      { type: "delete" },
      [
        { field: "Category", from: "Groceries", to: null },
        { field: "Planned", from: "RS 5,000", to: null },
        { field: "For", from: "Asha", to: null },
      ],
    ]);
  });

  it("other entities restoring over an existing row stay blocked", () => {
    const deleted = entry({ action: "deleted", before: original, entityType: "expense" });
    expect(planRevert(deleted, context({ ...original, amount: "900.00" }), "undo", f)).toEqual({
      kind: "blocked",
      reason: "This expense already exists again.",
    });
  });
});

describe("planRevert — marked paid", () => {
  it("removes the created expense and rolls the bill back", () => {
    const bill = { amount: "1500.00", categoryId: "cat-1", endDate: null, frequency: "monthly", icon: "wifi", id: "r-1", name: "Internet", nextDueDate: "2026-10-15", ownerMemberId: null, status: "active", vendor: null };
    const expense = { amount: "1500.00", categoryId: "cat-1", date: "2026-10-15", id: "e-9", note: "Internet", ownerMemberId: null, paidByMemberId: "m-1" };
    const paid = entry({ action: "paid", after: { ...bill, nextDueDate: "2026-11-15" }, before: bill, entityType: "recurring_expense", related: { createdExpense: [expense] } });

    const plan = planRevert(paid, context({ ...bill, nextDueDate: "2026-11-15" }, { children: { createdExpense: [expense] } }), "undo", f);
    expect(plan.kind === "apply" && [plan.operation, plan.changes]).toEqual([
      { deleteExpenseId: "e-9", set: { nextDueDate: "2026-10-15" }, type: "unpay" },
      [
        { field: "Next due", from: "15 November 2026", to: "15 October 2026" },
        { field: "Expense", from: "Groceries · RS 1,500 · Shared — Internet", to: null },
      ],
    ]);
  });
});

describe("revert rules", () => {
  it("offers both modes only for edits", () => {
    expect(revertModes("updated")).toEqual(["undo", "restore"]);
    expect(revertModes("deleted")).toEqual(["undo"]);
  });

  it("excludes account, imported and snapshot-less entries", () => {
    expect(isRevertible({ entityType: "expense", hasSnapshot: true, source: "web" })).toBe(true);
    expect(isRevertible({ entityType: "account", hasSnapshot: true, source: "web" })).toBe(false);
    expect(isRevertible({ entityType: "expense", hasSnapshot: true, source: "import" })).toBe(false);
    expect(isRevertible({ entityType: "expense", hasSnapshot: false, source: "web" })).toBe(false);
  });

  it("has a display field for every editable column of every entity", () => {
    for (const [entityType, config] of Object.entries(ENTITY_REVERT)) {
      const keys = config!.fields(f).map((s) => s.key);
      for (const key of config!.editable) expect(keys, `${entityType}.${key}`).toContain(key);
    }
  });
});
