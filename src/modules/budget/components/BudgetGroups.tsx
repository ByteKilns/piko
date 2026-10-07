"use client";

import { useState, useTransition } from "react";

import { toast } from "sonner";

import { Modal } from "@/components/Modal";
import { TabSwitcher } from "@/components/TabSwitcher";
import { Button } from "@/components/ui/button";
import { setBudgetItemAction, setIncomeAction } from "@/modules/budget/api/budget.actions";
import { BudgetGroupTable } from "@/modules/budget/components/BudgetGroupTable";
import { BudgetItemRow } from "@/modules/budget/components/BudgetItemRow";
import { IncomeForm } from "@/modules/budget/components/IncomeForm";
import type { BudgetGroup } from "@/modules/budget/lib/budget-groups";

type ViewTab = "all" | BudgetGroup["key"];

type Props = {
  categories: { id: string; name: string }[];
  groups: BudgetGroup[];
  incomesByMember: Record<string, number>;
  itemsByCategory: Record<string, Record<string, number>>;
  members: { id: string; name: string }[];
  month: number;
  realMemberId: string;
  year: number;
};

function initialIncomeValues(members: { id: string }[], incomesByMember: Record<string, number>) {
  return Object.fromEntries(members.map((m) => [m.id, String(incomesByMember[m.id] ?? "")]));
}

function itemKey(categoryId: string, owner: string) {
  return `${categoryId}::${owner}`;
}

// Only seeded with combos that already have a row, so Save doesn't create a
// zero-value budget_items row for every category x owner pair the user never
// touched — a category can have a row per owner (Shared, Me, Partner) all at
// once, so this can't collapse to one value per category the way it used to.
function initialItemValues(itemsByCategory: Record<string, Record<string, number>>) {
  const values: Record<string, string> = {};
  for (const [categoryId, byOwner] of Object.entries(itemsByCategory)) {
    for (const [owner, amount] of Object.entries(byOwner)) {
      values[itemKey(categoryId, owner)] = String(amount);
    }
  }
  return values;
}

export function BudgetGroups({ categories, groups, incomesByMember, itemsByCategory, members, month, realMemberId, year }: Props) {
  const [viewTab, setViewTab] = useState<ViewTab>("all");
  const [editing, setEditing] = useState(false);
  const [incomeValues, setIncomeValues] = useState(() => initialIncomeValues(members, incomesByMember));
  const [itemValues, setItemValues] = useState(() => initialItemValues(itemsByCategory));
  const [pending, startTransition] = useTransition();

  const ownerTabs = [
    { key: "shared", label: "Shared" },
    ...members.map((m) => ({ key: m.id, label: m.id === realMemberId ? "Me" : m.name })),
  ];
  const [ownerTab, setOwnerTab] = useState(ownerTabs[0].key);

  const visibleGroups = viewTab === "all" ? groups : groups.filter((g) => g.key === viewTab);

  function handleSaveAll() {
    startTransition(async () => {
      try {
        await Promise.all([
          ...members.map((m) =>
            setIncomeAction({ amount: Number(incomeValues[m.id]) || 0, memberId: m.id, month, year }),
          ),
          ...Object.entries(itemValues).map(([key, amount]) => {
            const [categoryId, owner] = key.split("::");
            return setBudgetItemAction({
              categoryId,
              month,
              ownerMemberId: owner === "shared" ? null : owner,
              plannedAmount: Number(amount) || 0,
              year,
            });
          }),
        ]);
        toast.success("Budget saved");
        setEditing(false);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to save");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <TabSwitcher
          onValueChange={(v) => setViewTab(v as ViewTab)}
          tabs={[
            { label: "Overview", value: "all" },
            ...groups.map((g) => ({
              label: g.key === "me" ? "Me" : g.key === "shared" ? "Shared" : g.label.replace(" Budget", ""),
              value: g.key,
            })),
          ]}
          value={viewTab}
        />
        <Button onClick={() => setEditing(true)} type="button">
          + Add Budget
        </Button>
      </div>

      <Modal
        className="sm:max-w-xl"
        footer={
          <Button disabled={pending} onClick={handleSaveAll} type="button">
            {pending ? "Saving..." : "Save Budget"}
          </Button>
        }
        onOpenChange={setEditing}
        open={editing}
        title="Edit budget"
      >
        <section>
          <h3 className="mb-2 text-base font-semibold text-foreground">Income</h3>
          <div className="space-y-3">
            {members.map((m) => (
              <IncomeForm
                key={m.id}
                memberId={m.id}
                memberName={m.name}
                onChange={(value) => setIncomeValues((prev) => ({ ...prev, [m.id]: value }))}
                value={incomeValues[m.id] ?? ""}
              />
            ))}
          </div>
        </section>

        <section>
          <h3 className="mb-2 text-base font-semibold text-foreground">Category allocations</h3>

          <TabSwitcher
            className="mb-2 w-full"
            onValueChange={setOwnerTab}
            tabs={ownerTabs.map((t) => ({ label: t.label, value: t.key }))}
            value={ownerTab}
          />
          <div className="divide-y">
            {categories.map((c) => {
              const key = itemKey(c.id, ownerTab);
              return (
                <BudgetItemRow
                  amount={itemValues[key] ?? ""}
                  categoryId={c.id}
                  categoryName={c.name}
                  key={c.id}
                  onAmountChange={(value) => setItemValues((prev) => ({ ...prev, [key]: value }))}
                />
              );
            })}
          </div>
        </section>
      </Modal>

      <div className="space-y-4">
        {visibleGroups.map((g) => (
          <BudgetGroupTable group={g} key={g.key} />
        ))}
      </div>
    </div>
  );
}
