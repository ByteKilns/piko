import type { ActivityFormatters } from "@/modules/activity/lib/activity-values";
import { diffFields } from "@/modules/activity/lib/diff";

export type LoanSnapshot = {
  counterpartyName: string;
  date: string;
  direction: string;
  dueDate?: null | string;
  installmentAmount?: null | number | string;
  installmentFrequency?: null | string;
  nextInstallmentDate?: null | string;
  note?: null | string;
  ownerMemberId: null | string;
  principalAmount: number | string;
};

function directionLabel(value: unknown): null | string {
  if (value === "given") return "Lent";
  if (value === "taken") return "Borrowed";
  return null;
}

// "Lent to Hari · RS 50,000 · Asha"
export function loanSummary(f: ActivityFormatters, loan: LoanSnapshot): string {
  const lead = `${loan.direction === "given" ? "Lent to" : "Borrowed from"} ${loan.counterpartyName}`;
  return [lead, f.money(loan.principalAmount), f.owner(loan.ownerMemberId)].filter(Boolean).join(" · ");
}

export function loanChanges(f: ActivityFormatters, before: LoanSnapshot, after: LoanSnapshot) {
  return diffFields(before, after, [
    { format: f.text, key: "counterpartyName", label: "Person" },
    { format: directionLabel, key: "direction", label: "Type" },
    { format: f.money, key: "principalAmount", label: "Amount" },
    { format: f.date, key: "date", label: "Date" },
    { format: f.date, key: "dueDate", label: "Due date" },
    { format: f.money, key: "installmentAmount", label: "Installment" },
    { format: f.text, key: "installmentFrequency", label: "Installment frequency" },
    { format: f.date, key: "nextInstallmentDate", label: "Next installment" },
    { format: f.owner, key: "ownerMemberId", label: "For" },
    { format: f.text, key: "note", label: "Note" },
  ]);
}

// "RS 5,000 received from Hari · by Ravi" — same wording as the payment notification.
export function loanPaymentSummary(
  f: ActivityFormatters,
  payment: { amount: number | string; memberId: string },
  loan: Pick<LoanSnapshot, "counterpartyName" | "direction">,
): string {
  const verb = loan.direction === "given" ? "received from" : "paid to";
  return `${f.money(payment.amount)} ${verb} ${loan.counterpartyName} · by ${f.member(payment.memberId)}`;
}
