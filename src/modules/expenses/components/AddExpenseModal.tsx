"use client";

import { useRouter } from "next/navigation";

import { Modal } from "@/components/Modal";
import { ExpenseForm } from "@/modules/expenses/components/ExpenseForm";

type Props = {
  categories: { groupName: string; id: string; name: string }[];
  currentMemberId: string;
  initial?: {
    amount: number;
    categoryId: string;
    date: string;
    note: string | null;
    ownerMemberId: string | null;
    paidByMemberId: string;
  };
  members: { id: string; name: string }[];
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

export function AddExpenseModal({ categories, currentMemberId, initial, members, onOpenChange, open }: Props) {
  const router = useRouter();

  return (
    <Modal onOpenChange={onOpenChange} open={open} title="Add Expense">
      <ExpenseForm
        categories={categories}
        currentMemberId={currentMemberId}
        initial={initial}
        members={members}
        onSuccess={() => {
          onOpenChange(false);
          router.refresh();
        }}
      />
    </Modal>
  );
}
