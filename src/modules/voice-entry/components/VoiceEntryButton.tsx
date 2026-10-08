"use client";

import { useEffect, useState } from "react";

import { Mic } from "lucide-react";

import { isSpeechRecognitionSupported } from "@/lib/useSpeechRecognition";
import { cn } from "@/lib/utils";
import { ExpenseDialog } from "@/modules/expenses/components/ExpenseDialog";
import { VoiceEntryModal } from "@/modules/voice-entry/components/VoiceEntryModal";
import type { ExpenseDraft } from "@/modules/voice-entry/lib/sanitize-voice-expense";

type Category = { groupName: string; id: string; name: string };
type Member = { id: string; name: string };

type Props = {
  categories: Category[];
  className?: string;
  currentMemberId: string;
  members: Member[];
  quickCategoryIds?: string[];
};

export function VoiceEntryButton({ categories, className, currentMemberId, members, quickCategoryIds }: Props) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [draft, setDraft] = useState<ExpenseDraft | null>(null);
  const [manualAddOpen, setManualAddOpen] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- feature detection must run client-side only, to avoid a server/client render mismatch
    setSupported(isSpeechRecognitionSupported());
  }, []);

  const resultModalOpen = draft !== null || manualAddOpen;

  function closeResultModal() {
    setDraft(null);
    setManualAddOpen(false);
  }

  return (
    <>
      <button
        aria-label="Add expense by voice"
        className={cn(className, !supported && "cursor-not-allowed opacity-50")}
        disabled={!supported}
        onClick={() => setListening(true)}
        title={supported ? undefined : "Voice input isn't supported in this browser"}
        type="button"
      >
        <Mic className="h-5 w-5" />
      </button>

      <VoiceEntryModal
        onClose={() => setListening(false)}
        onManualAdd={() => {
          setListening(false);
          setManualAddOpen(true);
        }}
        onParsed={(parsed) => {
          setListening(false);
          setDraft(parsed);
        }}
        open={listening}
      />

      {resultModalOpen && (
        <ExpenseDialog
          categories={categories}
          currentMemberId={currentMemberId}
          initial={draft ?? undefined}
          members={members}
          onOpenChange={(open) => {
            if (!open) closeResultModal();
          }}
          open
          quickCategoryIds={quickCategoryIds}
        />
      )}
    </>
  );
}
