"use client";

import { useRouter } from "next/navigation";

import { Modal } from "@/components/Modal";
import { ExpenseForm } from "@/modules/expenses/components/ExpenseForm";
import type { ExpenseRow } from "@/modules/expenses/hooks/useExpenseTableColumns";

type Props = {
  categories: { groupName: string; id: string; name: string }[];
  currentMemberId: string;
  expense: ExpenseRow | null;
  members: { id: string; name: string }[];
  onOpenChange: (open: boolean) => void;
};

export function EditExpenseModal({ categories, currentMemberId, expense, members, onOpenChange }: Props) {
  const router = useRouter();

  return (
    <Modal onOpenChange={onOpenChange} open={expense !== null} title="Edit Expense">
      {expense && (
        <ExpenseForm
          categories={categories}
          currentMemberId={currentMemberId}
          expenseId={expense.id}
          initial={{
            amount: expense.amount,
            categoryId: expense.categoryId,
            date: expense.date,
            note: expense.note,
            ownerMemberId: expense.ownerMemberId,
            paidByMemberId: expense.paidByMemberId,
          }}
          members={members}
          onSuccess={() => {
            onOpenChange(false);
            router.refresh();
          }}
        />
      )}
    </Modal>
  );
}
