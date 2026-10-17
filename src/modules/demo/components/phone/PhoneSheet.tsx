"use client";

import { useState } from "react";

import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ExpenseFields } from "@/modules/expenses/components/ExpenseDialog";
import type { ExpenseDraft } from "@/modules/voice-entry/lib/sanitize-voice-expense";

// Its own id: the website's Add expense dialog can be open at the same time.
const FORM_ID = "phone-expense-form";

type Props = {
  categories: { groupName: string; id: string; name: string }[];
  currentMemberId: string;
  draft: ExpenseDraft | null;
  members: { id: string; name: string }[];
  onClose: () => void;
  quickCategoryIds: string[];
};

// The mobile app's expense sheet: the website's own Add expense form, at phone
// width. Saving goes through the same action as the website.
export function PhoneSheet({ draft, onClose, ...fields }: Props) {
  const [pending, setPending] = useState(false);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b-2 border-ink px-4 py-2.5">
        <h2 className="text-lg font-extrabold">Add expense</h2>
        <Button aria-label="Close" onClick={onClose} size="icon-sm" type="button" variant="ghost">
          <X />
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <ExpenseFields {...fields} formId={FORM_ID} initial={draft ?? undefined} onDone={onClose} onPendingChange={setPending} />
      </div>
      <div className="border-t-2 border-rule px-4 py-2.5">
        <Button className="w-full" disabled={pending} form={FORM_ID} type="submit">
          {pending ? "Saving..." : "Save"}
        </Button>
      </div>
    </div>
  );
}
