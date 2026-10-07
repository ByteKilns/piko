"use client";

import { useState } from "react";

import { Plus } from "lucide-react";

import { AmountInput } from "@/components/AmountInput";
import { ArrowLink } from "@/components/ArrowLink";
import { EmptyState } from "@/components/EmptyState";
import { FilterMenu } from "@/components/FilterMenu";
import { Ledger, LedgerCell } from "@/components/Ledger";
import { LineTabs } from "@/components/LineTabs";
import { Meter } from "@/components/Meter";
import { Modal } from "@/components/Modal";
import { Money } from "@/components/Money";
import { Monogram, type MonogramPerson } from "@/components/Monogram";
import { MoreDetails } from "@/components/MoreDetails";
import { RowMenu } from "@/components/RowMenu";
import { GroupLabel, Row, type RowColumns, RowGroupHead, RowsHeader } from "@/components/Rows";
import { SectionHeading } from "@/components/SectionHeading";
import { Segmented } from "@/components/Segmented";
import { TextField } from "@/components/TextField";
import { Button } from "@/components/ui/button";

type Owner = "all" | "me" | "partner" | "shared";

const ME: MonogramPerson = { name: "Nirjal", role: "me" };
const PARTNER: MonogramPerson = { name: "Karuna", role: "partner" };

const COLUMNS: RowColumns = {
  lg: "minmax(170px,1fr) minmax(0,230px) 104px 28px",
  md: "minmax(140px,1fr) minmax(0,180px) 96px 28px",
  sm: "minmax(0,1fr) 88px 28px",
};

const ROWS = [
  { amount: 2340, category: "Groceries", note: "Bhatbhateni", owner: [ME, PARTNER], ownerLabel: "Shared" },
  { amount: 500, category: "Petrol", note: "Bike", owner: [ME], ownerLabel: "Me" },
  { amount: 6900, category: "Shopping", note: "", owner: [PARTNER], ownerLabel: "Karuna" },
];

export function DesignKitDemo() {
  const [owner, setOwner] = useState<Owner>("all");
  const [tab, setTab] = useState("All");
  const [category, setCategory] = useState<null | string>(null);
  const [forWho, setForWho] = useState("Me");
  const [amount, setAmount] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <div className="space-y-12">
      <Ledger>
        <LedgerCell
          bar={<Meter segments={[{ tone: "ink", value: 91515 }, { tone: "partner", value: 82170 }, { tone: "shared", value: 5607 }]} />}
          label="All expenses"
          lead
          note={
            <>
              <span>103 expenses</span>
              <span className="text-signal-ink">115% of income</span>
            </>
          }
          onSelect={() => setOwner("all")}
          selected={owner === "all"}
        >
          <Money size="lead" value={179291.88} />
        </LedgerCell>
        <LedgerCell label="Me" note="51% of total" onSelect={() => setOwner("me")} selected={owner === "me"}>
          <Money size="cell" value={91515.28} />
        </LedgerCell>
        <LedgerCell label="Karuna" note="46% of total" onSelect={() => setOwner("partner")} selected={owner === "partner"}>
          <Money size="cell" value={82169.6} />
        </LedgerCell>
        <LedgerCell label="Unallocated" note="Spending is above income">
          <Money size="cell" tone="negative" value={-23691.88} />
        </LedgerCell>
      </Ledger>

      <div>
        <div className="flex items-baseline gap-2">
          <span className="micro-label text-n-600">Safe to spend today</span>
          <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-signal-ink">
            <span className="size-1.5 bg-signal" />
            Over budget
          </span>
        </div>
        <Money className="mt-2.5" size="hero" value={512} />
        <div className="mt-6 grid max-w-md gap-3">
          <Meter label="Spent 148% of income" ratio={1.48} />
          <Meter ratio={0.88} />
          <Meter ratio={Number.POSITIVE_INFINITY} />
        </div>
      </div>

      <section>
        <SectionHeading aside={<ArrowLink href="/expenses">All expenses</ArrowLink>}>Recent expenses</SectionHeading>
        <LineTabs
          className="mt-4"
          label="Owner"
          onChange={setTab}
          tabs={[
            { count: 6, label: "All", value: "All" },
            { count: 2, label: "Me", value: "Me" },
            { count: 3, label: "Karuna", value: "Karuna" },
            { count: 1, label: "Shared", value: "Shared" },
          ]}
          value={tab}
        />
        <div className="flex flex-wrap items-center gap-1 py-4">
          <FilterMenu
            active={category !== null}
            label={category ?? "Category"}
            onSelect={(value) => setCategory(category === value ? null : value)}
            options={[
              { count: 14, label: "Groceries", value: "Groceries" },
              { count: 9, label: "Petrol", value: "Petrol" },
              { count: 3, label: "Shopping", value: "Shopping" },
            ]}
            value={category}
          />
        </div>
        <RowsHeader columns={COLUMNS}>
          <span>Expense</span>
          <span className="@max-[559px]:hidden">For · paid by</span>
          <span className="text-right">NPR</span>
          <span />
        </RowsHeader>
        <RowGroupHead columns={COLUMNS} first>
          <GroupLabel className="col-[1/-3]" label="Today" sub="20 Ashwin, Tuesday" />
          <span className="text-right text-[15px]">
            <Money value={9740} />
          </span>
          <span />
        </RowGroupHead>
        {ROWS.map((row) => (
          <Row columns={COLUMNS} key={row.category} onClick={() => setDialogOpen(true)}>
            <div className="flex min-w-0 items-baseline gap-2.5">
              <span className="text-[15px]">{row.category}</span>
              {row.note && <span className="truncate text-[13px] text-n-600">{row.note}</span>}
            </div>
            <div className="flex items-center gap-2.5 @max-[559px]:hidden">
              <Monogram people={row.owner} />
              <span className="text-sm">{row.ownerLabel}</span>
            </div>
            <span className="text-right text-[15px]">
              <Money value={row.amount} />
            </span>
            <RowMenu
              items={[
                { label: "Edit", onSelect: () => setDialogOpen(true) },
                { label: "Repeat today", onSelect: () => undefined },
                { destructive: true, label: "Delete", onSelect: () => undefined },
              ]}
            />
          </Row>
        ))}
      </section>

      <EmptyState
        action={
          <Button type="button" variant="outline">
            <Plus />
            Create a goal
          </Button>
        }
        body="Karuna's budget sets aside Rs 20,000 for savings this month. Give it a target and you'll see how close you are each month."
        title="No goals yet"
      />

      <Modal
        footer={
          <Button className="min-w-37.5 justify-start" type="button">
            Add expense
          </Button>
        }
        onOpenChange={setDialogOpen}
        open={dialogOpen}
        subtitle="Sample dialog"
        title="Add expense"
      >
        <AmountInput autoFocus label="Amount" onChange={(event) => setAmount(event.target.value)} size="xl" value={amount} />
        <Segmented
          label="For"
          onChange={setForWho}
          options={[
            { label: "Me", value: "Me" },
            { label: "Karuna", value: "Karuna" },
            { label: "Shared", value: "Shared" },
          ]}
          value={forWho}
        />
        <MoreDetails>
          <TextField label="Vendor" placeholder="Optional" />
        </MoreDetails>
      </Modal>
    </div>
  );
}
