import type { ActivityAction, ActivityChange, ActivityEntityType, ActivityLog, ActivitySnapshot, ActivitySource } from "@/db/schema";
import { type ExpenseSnapshot, expenseSummary } from "@/modules/expenses/lib/expense-activity";

import type { ActivityFormatters } from "../activity-values";
import type { FieldSpec } from "../diff";
import { rawEqual } from "../snapshot";
import { ENTITY_REVERT, type EntityRevert } from "./entities";

type Row = ActivitySnapshot;

export type RevertMode = "restore" | "undo"; // undo = only this change; restore = to before this change

// What exists *now*, loaded by the entity's store (household-scoped).
export type RevertContext = {
  children: Record<string, Row[]>;
  references: { categoryIds: ReadonlySet<string>; memberIds: ReadonlySet<string>; parentIds: ReadonlySet<string> };
  row: null | Row;
};

export type ParentUpdate = { id: string; set: Row };

export type RevertOperation =
  | { deleteExpenseId: null | string; set: Row; type: "unpay" }
  | { parentUpdate?: ParentUpdate; type: "delete" }
  | { related: Record<string, Row[]>; row: Row; type: "insert" }
  | { set: Row; type: "update" };

export type RevertPlan =
  | { changes: ActivityChange[]; kind: "apply"; operation: RevertOperation; warnings: string[] }
  | { kind: "blocked" | "noop"; reason: string };

export type RevertableEntry = Pick<ActivityLog, "action" | "after" | "before" | "entityType" | "related">;

const UNREVERTIBLE: ReadonlySet<ActivityEntityType> = new Set(["account"]);

export function isRevertible(entry: { entityType: ActivityEntityType; hasSnapshot: boolean; source: ActivitySource }): boolean {
  return entry.hasSnapshot && entry.source !== "import" && !UNREVERTIBLE.has(entry.entityType) && entry.entityType in ENTITY_REVERT;
}

export function revertModes(action: ActivityAction): RevertMode[] {
  return action === "updated" ? ["undo", "restore"] : ["undo"];
}

const blocked = (reason: string): RevertPlan => ({ kind: "blocked", reason });
const noop = (reason: string): RevertPlan => ({ kind: "noop", reason });

function labelOf(fields: FieldSpec<Row>[], key: string): string {
  return fields.find((s) => s.key === key)?.label ?? key;
}

type Differs = (key: string, a: unknown, b: unknown) => boolean;

// Like the log's diffFields, a field differs only when its *formatted* value
// does, so "" vs null or "1200.00" vs 1200 never count as a change. Opaque
// fields (e.g. a photo) format the same whatever they hold, so they compare raw.
function differsFor(config: EntityRevert, fields: FieldSpec<Row>[]): Differs {
  return (key, a, b) => {
    const spec = fields.find((s) => s.key === key);
    if (!spec || config.opaque?.includes(key)) return !rawEqual(a, b);
    return spec.format(a) !== spec.format(b);
  };
}

// current → target for every displayed field that differs. Only an opaque
// field can differ while formatting the same, so it gets a generic line.
function describeChanges(fields: FieldSpec<Row>[], differs: Differs, current: Row, target: Row): ActivityChange[] {
  const changes: ActivityChange[] = [];
  for (const spec of fields) {
    if (!differs(spec.key, current[spec.key], target[spec.key])) continue;
    const from = spec.format(current[spec.key]);
    const to = spec.format(target[spec.key]);
    changes.push(from === to ? { field: spec.label, from: "Current version", to: "Earlier version" } : { field: spec.label, from, to });
  }
  return changes;
}

// Every displayed value of a row, as appearing (restore) or disappearing (remove).
function describeRow(fields: FieldSpec<Row>[], row: Row, direction: "remove" | "restore"): ActivityChange[] {
  return fields.flatMap((spec) => {
    const value = spec.format(row[spec.key]);
    if (value === null) return [];
    return [direction === "remove" ? { field: spec.label, from: value, to: null } : { field: spec.label, from: null, to: value }];
  });
}

function planUpdate(config: EntityRevert, fields: FieldSpec<Row>[], entry: RevertableEntry, context: RevertContext, mode: RevertMode): RevertPlan {
  const before = entry.before ?? {};
  const after = entry.after ?? {};
  const current = context.row;
  if (!current) return blocked(`This ${config.noun} has since been deleted — revert that deletion first.`);

  const differs = differsFor(config, fields);
  const keys = config.editable.filter((key) => key in before && (mode === "restore" || differs(key, before[key], after[key])));
  const set: Row = {};
  for (const key of keys) if (differs(key, current[key], before[key])) set[key] = before[key] ?? null;
  if (Object.keys(set).length === 0) return noop("Already back to how it was.");

  const target = { ...current, ...set };
  const warnings = Object.keys(set)
    .filter((key) => key in after && differs(key, current[key], after[key]))
    .map((key) => {
      const spec = fields.find((s) => s.key === key);
      const now = spec?.format(current[key]);
      return `This also overrides a later change to ${labelOf(fields, key)}${now ? ` (now ${now})` : ""}.`;
    });
  return { changes: describeChanges(fields, differs, current, target), kind: "apply", operation: { set, type: "update" }, warnings };
}

function planRemove(config: EntityRevert, fields: FieldSpec<Row>[], entry: RevertableEntry, context: RevertContext, f: ActivityFormatters): RevertPlan {
  if (!context.row) return noop("Already removed.");
  const changes = describeRow(fields, context.row, "remove");
  const warnings = config.children.flatMap((child) => {
    const n = context.children[child.kind]?.length ?? 0;
    return n > 0 && child.removed ? [child.removed(n)] : [];
  });

  let parentUpdate: ParentUpdate | undefined;
  const link = entry.related?.loan?.[0];
  const loan = context.children.loan?.[0];
  if (entry.entityType === "loan_payment" && link && loan) {
    if (rawEqual(loan.nextInstallmentDate, link.nextInstallmentDateAfter)) {
      parentUpdate = { id: String(link.id), set: { nextInstallmentDate: link.nextInstallmentDateBefore ?? null } };
      changes.push({ field: "Next installment", from: f.date(loan.nextInstallmentDate), to: f.date(link.nextInstallmentDateBefore) });
    } else {
      warnings.push("Next installment date was changed since — left as is.");
    }
  }
  return { changes, kind: "apply", operation: parentUpdate ? { parentUpdate, type: "delete" } : { type: "delete" }, warnings };
}

// Restoring an entity whose identity outlives its row (a budget line is its
// category/month) sets the row there now back to `before` rather than adding a second.
function planReplace(config: EntityRevert, fields: FieldSpec<Row>[], before: Row, current: Row): RevertPlan {
  const differs = differsFor(config, fields);
  const set: Row = {};
  for (const key of config.editable) if (key in before && differs(key, current[key], before[key])) set[key] = before[key] ?? null;
  if (Object.keys(set).length === 0) return noop("Already back to how it was.");
  return {
    changes: describeChanges(fields, differs, current, { ...current, ...set }),
    kind: "apply",
    operation: { set, type: "update" },
    warnings: [`This replaces the ${config.noun} that's there now.`],
  };
}

function planRestore(config: EntityRevert, fields: FieldSpec<Row>[], entry: RevertableEntry, context: RevertContext): RevertPlan {
  const before = entry.before;
  if (!before) return blocked("This change can't be reverted.");
  if (context.row && !config.restoreReplacesExisting) return blocked(`This ${config.noun} already exists again.`);

  const refs = config.references(before);
  if (refs.categoryIds.some((id) => !context.references.categoryIds.has(id))) return blocked("Its category no longer exists.");
  if (refs.memberIds.some((id) => !context.references.memberIds.has(id))) {
    return blocked("A member it belonged to is no longer in the household.");
  }
  if (refs.parentId !== undefined && !context.references.parentIds.has(refs.parentId)) {
    return blocked(`The ${config.parentNoun ?? "item"} it belonged to no longer exists — revert that deletion first.`);
  }
  if (context.row) return planReplace(config, fields, before, context.row);

  const related = entry.related ?? {};
  const warnings = config.children.flatMap((child) => {
    const n = related[child.kind]?.length ?? 0;
    return n > 0 && child.restored ? [child.restored(n)] : [];
  });
  return { changes: describeRow(fields, before, "restore"), kind: "apply", operation: { related, row: before, type: "insert" }, warnings };
}

function planUnpay(
  config: EntityRevert,
  fields: FieldSpec<Row>[],
  entry: RevertableEntry,
  context: RevertContext,
  f: ActivityFormatters,
): RevertPlan {
  const before = entry.before ?? {};
  const after = entry.after ?? {};
  const bill = context.row;
  if (!bill) return blocked("This recurring bill has since been deleted — revert that deletion first.");

  const differs = differsFor(config, fields);
  const set: Row = {};
  for (const key of ["nextDueDate", "status"]) if (key in before && differs(key, bill[key], before[key])) set[key] = before[key] ?? null;
  const expense = context.children.createdExpense?.[0] ?? null;
  if (!expense && Object.keys(set).length === 0) return noop("Already back to how it was.");

  const changes = describeChanges(fields, differs, bill, { ...bill, ...set });
  if (expense) changes.push({ field: "Expense", from: expenseSummary(f, expense as ExpenseSnapshot), to: null });
  const warnings: string[] = [];
  if ("nextDueDate" in set && differs("nextDueDate", bill.nextDueDate, after.nextDueDate)) {
    warnings.push(`This also overrides a later change to Next due (now ${f.date(bill.nextDueDate)}).`);
  }
  if (!expense) warnings.push("The expense it created was already removed.");
  return { changes, kind: "apply", operation: { deleteExpenseId: expense ? String(expense.id) : null, set, type: "unpay" }, warnings };
}

export function planRevert(entry: RevertableEntry, context: RevertContext, mode: RevertMode, f: ActivityFormatters): RevertPlan {
  const config = ENTITY_REVERT[entry.entityType];
  if (!config || (!entry.before && !entry.after)) return blocked("This change can't be reverted.");
  const fields = config.fields(f);

  if (entry.action === "created") return planRemove(config, fields, entry, context, f);
  if (entry.action === "deleted") return planRestore(config, fields, entry, context);
  if (entry.action === "paid") return planUnpay(config, fields, entry, context, f);
  return planUpdate(config, fields, entry, context, mode);
}
