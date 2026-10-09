"use client";

import { useState } from "react";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { LineTabs } from "@/components/LineTabs";
import { PageHeader } from "@/components/PageHeader";
import { RowMenu } from "@/components/RowMenu";
import { GroupLabel, Row, type RowColumns, RowGroupHead, RowsHeader } from "@/components/Rows";
import { Button } from "@/components/ui/button";
import { archiveCategoryAction, restoreCategoryAction } from "@/modules/categories/api/categories.actions";
import { CategoryDialog, type CategoryEditing } from "@/modules/categories/components/CategoryDialog";
import { CategoryIcon } from "@/modules/categories/components/CategoryIcon";

type Tab = "active" | "archived";

const COLUMNS: RowColumns = { lg: "28px minmax(0,1fr) 110px 28px" };

export function CategoriesView({ categories }: { categories: CategoryEditing[] }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("active");
  const [dialog, setDialog] = useState<{ editing: CategoryEditing | null; open: boolean }>({ editing: null, open: false });

  const active = categories.filter((c) => !c.archived);
  const archived = categories.filter((c) => c.archived);
  const visible = tab === "active" ? active : archived;

  const groups = [...new Set(visible.map((c) => c.groupName))].sort();
  const groupRows = groups.map((groupName) => ({ groupName, rows: visible.filter((c) => c.groupName === groupName) }));

  async function run(action: () => Promise<unknown>, done: string) {
    try {
      await action();
      toast.success(done);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  return (
    <div>
      <PageHeader
        actions={
          <Button onClick={() => setDialog({ editing: null, open: true })} variant="secondary">
            <Plus />
            Add category
          </Button>
        }
        subtitle="Used across expenses and budgets"
        title="Categories"
      />

      <LineTabs
        className="mb-6"
        label="Status"
        onChange={(value) => setTab(value)}
        tabs={[
          { count: active.length, label: "Active", value: "active" },
          { count: archived.length, label: "Archived", value: "archived" },
        ]}
        value={tab}
      />

      <RowsHeader columns={COLUMNS}>
        <span className="col-span-2">Category</span>
        <span>Type</span>
        <span />
      </RowsHeader>

      {groupRows.map((group, index) => (
        <div key={group.groupName}>
          <RowGroupHead columns={COLUMNS} first={index === 0}>
            <GroupLabel className="col-span-2" label={group.groupName} sub={`${group.rows.length}`} />
            <span />
            <span />
          </RowGroupHead>
          {group.rows.map((category) => (
            <Row columns={COLUMNS} key={category.id} onClick={() => setDialog({ editing: category, open: true })}>
              <CategoryIcon groupName={category.groupName} icon={category.icon} name={category.name} />
              <span className="truncate text-[15px]">{category.name}</span>
              <span className="text-xs text-n-600">{category.budgetType === "fixed" ? "Fixed" : "Flexible"}</span>
              <div className="flex justify-end">
                <RowMenu
                  items={[
                    { label: "Edit", onSelect: () => setDialog({ editing: category, open: true }) },
                    category.archived
                      ? { label: "Restore", onSelect: () => void run(() => restoreCategoryAction(category.id), "Category restored") }
                      : { destructive: true, label: "Archive", onSelect: () => void run(() => archiveCategoryAction(category.id), "Category archived") },
                  ]}
                />
              </div>
            </Row>
          ))}
        </div>
      ))}

      {visible.length === 0 && (
        <div className="border-b border-n-300 px-2 py-9 text-sm text-n-700">
          {tab === "active" ? "No categories yet." : "No archived categories."}
        </div>
      )}

      <CategoryDialog
        category={dialog.editing}
        onOpenChange={(value) => !value && setDialog({ editing: null, open: false })}
        open={dialog.open}
      />
    </div>
  );
}
