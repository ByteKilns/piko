"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { AmountInput } from "@/components/AmountInput";
import { Modal } from "@/components/Modal";
import { SelectField } from "@/components/SelectField";
import { TextField } from "@/components/TextField";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/money";
import { addFundTopUpAction, archiveFundAction, createFundAction, updateFundAction } from "@/modules/funds/api/funds.actions";
import { suggestedMonthly, type YearMonth } from "@/modules/funds/lib/fund-math";

export type FundView = {
  balance: number;
  due: null | YearMonth;
  dueLabel: null | string;
  id: string;
  monthlyAmount: number;
  name: string;
  // What to set aside each month to have the target by the due month.
  suggested: null | number;
  target: null | number;
};

type Props = {
  // Months a fund can be needed by, e.g. { label: "Asoj 2084", value: "2084-6" }.
  dueOptions: { label: string; value: string }[];
  // Edit mode when set; otherwise the dialog adds a new fund.
  fund?: FundView;
  // The month the page shows, for the suggested monthly amount.
  now: YearMonth;
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

const FORM_ID = "fund-form";
const NO_DATE = "none";

export function FundDialog({ onOpenChange, open, ...rest }: Props) {
  const [pending, setPending] = useState(false);

  return (
    <Modal
      className="sm:max-w-120"
      footer={
        <>
          <Button className="min-w-35 justify-start" disabled={pending} form={FORM_ID} type="submit">
            {pending ? "Saving..." : "Save fund"}
          </Button>
          {rest.fund && (
            <Button disabled={pending} form={FORM_ID} type="submit" value="archive" variant="destructive">
              Archive fund
            </Button>
          )}
        </>
      }
      hint="Enter to save · Esc to close"
      onOpenChange={onOpenChange}
      open={open}
      subtitle="A pile in your everyday account for an occasional cost"
      title={rest.fund ? rest.fund.name : "Add a fund"}
    >
      <FundFields {...rest} onDone={() => onOpenChange(false)} onPendingChange={setPending} />
    </Modal>
  );
}

type FieldsProps = Omit<Props, "onOpenChange" | "open"> & { onDone: () => void; onPendingChange: (pending: boolean) => void };

function FundFields({ dueOptions, fund, now, onDone, onPendingChange }: FieldsProps) {
  const router = useRouter();
  const [name, setName] = useState(fund?.name ?? "");
  const [monthly, setMonthly] = useState(fund ? String(fund.monthlyAmount) : "");
  const [target, setTarget] = useState(fund?.target ? String(fund.target) : "");
  const [due, setDue] = useState(fund?.due ? `${fund.due.year}-${fund.due.month}` : NO_DATE);
  const [topUp, setTopUp] = useState("");
  const [topUpNote, setTopUpNote] = useState("");
  const [busy, setBusy] = useState(false);

  const [dueYear, dueMonth] = due.split("-").map(Number);
  const dueValue = due === NO_DATE ? null : { month: dueMonth, year: dueYear };
  const targetValue = Number(target) > 0 ? Number(target) : null;
  const suggestion = suggestedMonthly({ balance: fund?.balance ?? 0, due: dueValue, now, target: targetValue });

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const intent = (event.nativeEvent as SubmitEvent).submitter?.getAttribute("value") ?? "save";
    if (intent !== "archive" && !name.trim()) {
      toast.error("Give the fund a name");
      return;
    }

    onPendingChange(true);
    try {
      if (intent === "archive" && fund) {
        await archiveFundAction(fund.id);
        toast.success("Fund archived");
      } else {
        const input = { due: dueValue, monthlyAmount: Number(monthly) || 0, name: name.trim(), target: targetValue };
        if (fund) {
          await updateFundAction(fund.id, input);
        } else {
          await createFundAction(input);
        }
        toast.success("Fund saved");
      }
      onDone();
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      onPendingChange(false);
    }
  }

  async function addMoney() {
    if (!fund) return;
    const amount = Number(topUp);
    if (!(amount > 0)) {
      toast.error("Enter how much to add");
      return;
    }
    setBusy(true);
    try {
      await addFundTopUpAction(fund.id, { amount, note: topUpNote.trim() || undefined });
      setTopUp("");
      setTopUpNote("");
      toast.success("Money added");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <form className="flex flex-col gap-5.5" id={FORM_ID} noValidate onSubmit={onSubmit}>
        <TextField data-autofocus label="Name" onChange={(event) => setName(event.target.value)} placeholder="e.g. WorldLink, Festivals, Health" value={name} />
        <AmountInput label="Set aside each month" onChange={(event) => setMonthly(event.target.value)} placeholder="0.00" value={monthly} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <AmountInput label="Target (optional)" onChange={(event) => setTarget(event.target.value)} placeholder="0.00" value={target} />
          <SelectField label="Needed by" onValueChange={setDue} options={[{ label: "No date", value: NO_DATE }, ...dueOptions]} value={due} />
        </div>
        {suggestion !== null && (
          <p className="text-xs leading-normal text-n-600">
            {suggestion === 0 ? "What's in the fund already covers it." : `Set aside ${formatMoney(suggestion)} a month to have it in time.`}
          </p>
        )}
      </form>

      {fund && (
        <section className="flex flex-col gap-3 border-t border-n-300 pt-4">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="text-sm font-semibold">Add money</h3>
            <span className="text-[13px] text-n-600">Holds {formatMoney(fund.balance)}</span>
          </div>
          <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_auto]">
            <AmountInput label="Amount to add" onChange={(event) => setTopUp(event.target.value)} placeholder="0.00" value={topUp} />
            <TextField label="Note" onChange={(event) => setTopUpNote(event.target.value)} placeholder="e.g. from the bonus" value={topUpNote} />
            <Button disabled={busy} onClick={() => void addMoney()} type="button" variant="outline">
              Add money
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
