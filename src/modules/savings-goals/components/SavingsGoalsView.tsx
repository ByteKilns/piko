"use client";

import { useState } from "react";

import { ArrowRight, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Ledger, LedgerCell } from "@/components/Ledger";
import { LineTabs } from "@/components/LineTabs";
import { Meter } from "@/components/Meter";
import { Money } from "@/components/Money";
import { Monogram, type MonogramPerson } from "@/components/Monogram";
import { PageHeader } from "@/components/PageHeader";
import { RowMenu } from "@/components/RowMenu";
import { Row, type RowColumns, RowsHeader } from "@/components/Rows";
import { SectionHeading } from "@/components/SectionHeading";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/money";
import type { MonthNavModel } from "@/lib/month-nav";
import { deleteSavingsGoalAction } from "@/modules/savings-goals/api/savings-goals.actions";
import { AddMoneyDialog } from "@/modules/savings-goals/components/AddMoneyDialog";
import { GoalDialog, type GoalStarter, type SavingsGoalEditing, type SavingsGoalOwnerKey } from "@/modules/savings-goals/components/GoalDialog";

type Member = { id: string; name: string };

export type GoalRowModel = {
  by: string;
  editing: SavingsGoalEditing;
  id: string;
  name: string;
  ownerKey: SavingsGoalOwnerKey;
  pct: null | number;
  saved: number;
  target: null | number;
};

export type ContributionModel = { amount: number; date: string; goalName: string; id: string };

type LedgerFigures = {
  avg: string;
  avgSub: string;
  count: string;
  countSub: string;
  month: number;
  monthSub: string;
  saved: number;
  savedSub: string;
  savedW: number;
};

type Props = {
  contributions: ContributionModel[];
  currentMemberId: string;
  emergencyTarget: number;
  goals: GoalRowModel[];
  ledger: LedgerFigures;
  members: Member[];
  monthNav: MonthNavModel;
  savingsBudgetAmount: null | number;
};

type Tab = "all" | SavingsGoalOwnerKey;

const COLUMNS: RowColumns = {
  lg: "minmax(160px,1.6fr) minmax(0,0.8fr) minmax(0,1fr) minmax(120px,1.3fr) minmax(0,0.9fr) 100px",
  md: "minmax(130px,1.4fr) minmax(0,0.8fr) minmax(0,1fr) minmax(90px,1.1fr) minmax(0,0.9fr) 92px",
  sm: "minmax(110px,1.4fr) minmax(0,0.8fr) minmax(0,1fr) minmax(80px,1.1fr) minmax(0,0.9fr) 92px",
};
const SHOWN_CONTRIBUTIONS = 6;

export function SavingsGoalsView(props: Props) {
  const { currentMemberId, members } = props;
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("all");
  const [goalDialog, setGoalDialog] = useState<{ editing: null | SavingsGoalEditing; open: boolean; starter: null | GoalStarter }>({
    editing: null,
    open: false,
    starter: null,
  });
  const [moneyGoal, setMoneyGoal] = useState<null | { id: string; name: string }>(null);

  const me = members.find((m) => m.id === currentMemberId);
  const partner = members.find((m) => m.id !== currentMemberId) ?? null;
  const people: Record<"me" | "partner", MonogramPerson> = {
    me: { name: me?.name ?? "Me", role: "me" },
    partner: { name: partner?.name ?? "Partner", role: "partner" },
  };
  const label = (key: SavingsGoalOwnerKey) => (key === "shared" ? "Shared" : key === "me" ? "Me" : (partner?.name ?? "Partner"));
  const monograms = (key: SavingsGoalOwnerKey): MonogramPerson[] => {
    if (key === "shared") return partner ? [people.me, people.partner] : [people.me];
    return [people[key]];
  };

  const starters: { hint: string; name: string; target: null | number }[] = [
    { hint: "Three months of your spending", name: "Emergency fund", target: props.emergencyTarget || null },
    { hint: "Bike, scooter or car", name: "New vehicle", target: null },
    { hint: "A trip worth planning for", name: "Travel", target: null },
    { hint: "Courses, fees, a degree", name: "Education", target: null },
    { hint: "Name your own goal", name: "Something else", target: null },
  ];

  const visible = props.goals.filter((goal) => tab === "all" || tab === goal.ownerKey);

  function openNew() {
    setGoalDialog({ editing: null, open: true, starter: null });
  }

  async function remove(goal: GoalRowModel) {
    if (!window.confirm(`Delete "${goal.name}"? Its contributions are removed too.`)) return;
    try {
      await deleteSavingsGoalAction(goal.id);
      toast.success("Goal deleted");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    }
  }

  return (
    <div>
      <PageHeader
        actions={
          <Button className="h-9.5" onClick={openNew} variant="outline">
            <Plus />
            New goal
          </Button>
        }
        monthNav={props.monthNav}
        title="Savings goals"
      />

      <Ledger>
        <LedgerCell bar={<Meter ratio={props.ledger.savedW / 100} />} label="Saved toward goals" lead note={props.ledger.savedSub}>
          <Money size="lead" tone={props.ledger.saved > 0 ? "default" : "muted"} value={props.ledger.saved} />
        </LedgerCell>
        <LedgerCell label="Added this month" note={props.ledger.monthSub}>
          <Money size="cell" value={props.ledger.month} />
        </LedgerCell>
        <LedgerCell label="Goals" note={props.ledger.countSub}>
          <span className="text-2xl leading-none font-semibold tabular-nums">{props.ledger.count}</span>
        </LedgerCell>
        <LedgerCell label="Average progress" note={props.ledger.avgSub}>
          <span className="text-2xl leading-none font-semibold tabular-nums">{props.ledger.avg}</span>
        </LedgerCell>
      </Ledger>

      {props.goals.length === 0 ? (
        <section className="mt-11 grid grid-cols-1 gap-x-16 gap-y-9 @min-[780px]:grid-cols-2">
          <div className="flex min-w-0 flex-col items-start gap-3.5">
            <h2 className="max-w-[15ch] text-[34px] leading-[1.08] font-extrabold tracking-[-0.02em] text-balance">
              Nothing saved toward a goal yet.
            </h2>
            <p className="max-w-[44ch] text-[15px] leading-[1.55] text-n-800 text-pretty">
              Goals give leftover money a job.{" "}
              {props.savingsBudgetAmount !== null ? (
                <>
                  Your budget already sets aside <strong className="text-ink">{formatMoney(props.savingsBudgetAmount)}</strong> for savings this
                  month — name what it&apos;s for and Piko will show how close you are.
                </>
              ) : (
                "Name what you're saving for and Piko will show how close you are."
              )}
            </p>
            <Button className="mt-2 h-10 justify-start" onClick={openNew} type="button">
              <Plus />
              Create a goal
            </Button>
          </div>

          <div className="min-w-0">
            <div className="micro-label border-b-2 border-rule pb-2.5 text-n-600">Or start from</div>
            {starters.map((starter) => (
              <button
                className="grid w-full grid-cols-[minmax(0,1fr)_auto_16px] items-center gap-4 border-b border-n-300 px-2 py-3.5 text-left text-ink hover:bg-ink/4"
                key={starter.name}
                onClick={() =>
                  setGoalDialog({
                    editing: null,
                    open: true,
                    starter: { name: starter.name === "Something else" ? "" : starter.name, target: starter.target },
                  })
                }
                type="button"
              >
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-[15px]">{starter.name}</span>
                  <span className="text-[13px] text-n-600">{starter.hint}</span>
                </span>
                <span className="text-sm whitespace-nowrap text-n-700 tabular-nums">
                  {starter.target !== null ? `Rs ${Math.round(starter.target).toLocaleString("en-US")}` : ""}
                </span>
                <ArrowRight aria-hidden className="size-3.75 text-n-600" />
              </button>
            ))}
          </div>
        </section>
      ) : (
        <>
          <LineTabs
            className="mt-5.5 mb-6.5"
            label="Owner"
            onChange={(value) => setTab(value)}
            tabs={[
              { count: props.goals.length, label: "All", value: "all" },
              { count: props.goals.filter((g) => g.ownerKey === "me").length, label: "Me", value: "me" },
              ...(partner ? [{ count: props.goals.filter((g) => g.ownerKey === "partner").length, label: partner.name, value: "partner" as const }] : []),
              { count: props.goals.filter((g) => g.ownerKey === "shared").length, label: "Shared", value: "shared" },
            ]}
            value={tab}
          />

          <RowsHeader columns={COLUMNS}>
            <span>Goal</span>
            <span>For</span>
            <span className="text-right">Saved</span>
            <span>Progress</span>
            <span>Target date</span>
            <span />
          </RowsHeader>

          {visible.map((goal) => (
            <Row columns={COLUMNS} key={goal.id} onClick={() => setGoalDialog({ editing: goal.editing, open: true, starter: null })}>
              <span className="truncate text-[15px]">{goal.name}</span>
              <div className="flex min-w-0 items-center gap-2.5">
                <Monogram people={monograms(goal.ownerKey)} />
                <span className="text-sm whitespace-nowrap">{label(goal.ownerKey)}</span>
              </div>
              <div className="flex flex-col items-end gap-0.5">
                <span className="text-[15px] font-semibold">
                  <Money value={goal.saved} />
                </span>
                <span className="text-xs whitespace-nowrap text-n-600">
                  {goal.target !== null ? `of ${Math.round(goal.target).toLocaleString("en-US")}` : "Ongoing"}
                </span>
              </div>
              <div className="flex min-w-0 items-center gap-2.5">
                {goal.target !== null ? (
                  <>
                    <Meter className="flex-1" ratio={goal.pct !== null ? goal.pct / 100 : 0} />
                    <span className="w-9.5 text-right text-[13px] font-semibold tabular-nums">{goal.pct ?? 0}%</span>
                  </>
                ) : (
                  <span className="text-[13px] text-n-600">Ongoing</span>
                )}
              </div>
              <span className="text-sm whitespace-nowrap text-n-800">{goal.by}</span>
              <div className="flex justify-end" onClick={(event) => event.stopPropagation()}>
                <Button
                  className="h-auto px-1.5 py-0.75 text-[13px]"
                  onClick={() => setMoneyGoal({ id: goal.id, name: goal.name })}
                  type="button"
                  variant="ghost"
                >
                  Add money
                </Button>
                <RowMenu
                  items={[
                    { label: "Edit", onSelect: () => setGoalDialog({ editing: goal.editing, open: true, starter: null }) },
                    { destructive: true, label: "Delete", onSelect: () => void remove(goal) },
                  ]}
                />
              </div>
            </Row>
          ))}

          {visible.length === 0 && (
            <div className="border-b border-n-300 px-2 py-9 text-sm text-n-700">No goals for {label(tab as SavingsGoalOwnerKey)} yet.</div>
          )}

          <button
            className="flex w-full items-center gap-2 border-b border-n-300 px-2 py-3.5 text-left text-sm text-n-700 hover:bg-ink/4 hover:text-ink"
            onClick={openNew}
            type="button"
          >
            <Plus aria-hidden className="size-3.75" />
            New goal
          </button>

          {props.contributions.length > 0 && (
            <section className="mt-12 max-w-160">
              <SectionHeading>Recent contributions</SectionHeading>
              {props.contributions.slice(0, SHOWN_CONTRIBUTIONS).map((contribution) => (
                <div className="grid grid-cols-[90px_minmax(0,1fr)_auto] items-baseline gap-4 border-b border-n-300 py-2.75" key={contribution.id}>
                  <span className="text-[13px] text-n-600">{contribution.date}</span>
                  <span className="truncate text-[15px]">{contribution.goalName}</span>
                  <span className="text-[15px] tabular-nums">
                    <span className="font-semibold">+{Math.round(contribution.amount).toLocaleString("en-US")}</span>
                    <span className="text-n-500">.00</span>
                  </span>
                </div>
              ))}
            </section>
          )}
        </>
      )}

      <GoalDialog
        currentMemberId={currentMemberId}
        editing={goalDialog.editing}
        members={members}
        onOpenChange={(value) => !value && setGoalDialog({ editing: null, open: false, starter: null })}
        open={goalDialog.open}
        starter={goalDialog.starter}
      />

      <AddMoneyDialog
        currentMemberId={currentMemberId}
        goal={moneyGoal}
        members={members}
        onOpenChange={(value) => !value && setMoneyGoal(null)}
        open={moneyGoal !== null}
      />
    </div>
  );
}
