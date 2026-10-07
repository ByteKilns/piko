"use client";

import { useRouter } from "next/navigation";

import { Modal } from "@/components/Modal";
import { BulkExpenseForm } from "@/modules/expenses/components/BulkExpenseForm";

type Props = {
  categories: { groupName: string; id: string; name: string }[];
  currentMemberId: string;
  members: { id: string; name: string }[];
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

export function BulkAddExpenseModal({ categories, currentMemberId, members, onOpenChange, open }: Props) {
  const router = useRouter();

  return (
    <Modal
      bodyClassName="overflow-visible"
      className="overflow-visible sm:max-w-7xl"
      onOpenChange={onOpenChange}
      open={open}
      title="Add Expenses in Bulk"
    >
      <BulkExpenseForm
        categories={categories}
        currentMemberId={currentMemberId}
        members={members}
        onSuccess={() => {
          onOpenChange(false);
          router.refresh();
        }}
      />
    </Modal>
  );
}
