"use client";

import { useCallback, useState } from "react";

import { Button } from "@/components/ui/button";
import { todayISO } from "@/lib/today";
import type { RecentGroup } from "@/modules/expenses/lib/recent-groups";
import type { ExpenseDraft } from "@/modules/voice-entry/lib/sanitize-voice-expense";

import { draftForPhrase, type VoicePhrase } from "../lib/voice-phrases";
import { useDemo } from "./DemoProvider";
import { PhoneFrame } from "./phone/PhoneFrame";
import { PhoneHome } from "./phone/PhoneHome";
import { PhoneSheet } from "./phone/PhoneSheet";
import { PhoneVoice } from "./phone/PhoneVoice";

type Props = {
  categories: { groupName: string; id: string; name: string }[];
  currentMemberId: string;
  members: { id: string; name: string }[];
  quickCategoryIds: string[];
  recent: RecentGroup[];
};

// The mobile app, on screen: docked beside the website on wide screens, full
// screen on a phone. Saving refreshes the page, so both sides show the new
// expense at once.
export function DemoPhone({ categories, currentMemberId, members, quickCategoryIds, recent }: Props) {
  const demo = useDemo();
  const [screen, setScreen] = useState<"home" | "sheet" | "voice">("home");
  const [draft, setDraft] = useState<ExpenseDraft | null>(null);
  const partnerId = members.find((m) => m.id !== currentMemberId)?.id ?? null;

  const openSheet = useCallback((next: ExpenseDraft | null) => {
    setDraft(next);
    setScreen("sheet");
  }, []);
  const onHeard = useCallback(
    (phrase: VoicePhrase) => openSheet(draftForPhrase(phrase, { categories, currentMemberId, partnerId, today: todayISO() })),
    [categories, currentMemberId, openSheet, partnerId],
  );

  if (!demo?.phoneOpen) return null;

  return (
    <section
      aria-label="Demo phone"
      className="fixed inset-0 z-50 flex flex-col bg-paper xl:sticky xl:top-0 xl:z-auto xl:h-screen xl:w-110 xl:shrink-0 xl:items-center xl:justify-center xl:gap-3 xl:border-l-2 xl:border-rule xl:bg-surface"
    >
      <div className="flex items-center justify-between border-b-2 border-ink px-4 py-2 xl:w-98 xl:border-0 xl:px-1 xl:py-0">
        <span className="text-sm font-semibold">The Piko phone app</span>
        <Button onClick={() => demo.setPhoneOpen(false)} size="sm" type="button" variant="ghost">
          Close
        </Button>
      </div>
      <PhoneFrame>
        {screen === "home" && <PhoneHome onType={() => openSheet(null)} onVoice={() => setScreen("voice")} recent={recent} />}
        {screen === "voice" && <PhoneVoice onCancel={() => setScreen("home")} onHeard={onHeard} onTypeInstead={() => openSheet(null)} />}
        {screen === "sheet" && (
          <PhoneSheet
            categories={categories}
            currentMemberId={currentMemberId}
            draft={draft}
            members={members}
            onClose={() => setScreen("home")}
            quickCategoryIds={quickCategoryIds}
          />
        )}
      </PhoneFrame>
    </section>
  );
}
