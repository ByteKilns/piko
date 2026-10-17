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
import { PhoneSettings } from "./phone/PhoneSettings";
import { PhoneSheet } from "./phone/PhoneSheet";
import { PhoneVoice } from "./phone/PhoneVoice";

type Props = {
  categories: { groupName: string; id: string; name: string }[];
  currentMemberId: string;
  members: { id: string; name: string }[];
  quickCategoryIds: string[];
  recent: RecentGroup[];
};

// The mobile app, on screen: a Pixel-shaped phone in a modal over the website.
// Saving goes through the same action and refreshes the page, so both sides
// show the new expense at once.
export function DemoPhone({ categories, currentMemberId, members, quickCategoryIds, recent }: Props) {
  const demo = useDemo();
  const [screen, setScreen] = useState<"home" | "settings" | "sheet" | "voice">("home");
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-3 sm:p-5">
      <section aria-label="Demo phone" className="flex h-full max-h-full flex-col items-center gap-2">
        <div className="flex w-full shrink-0 justify-end">
          <Button className="text-paper hover:bg-paper/10" onClick={() => demo.setPhoneOpen(false)} size="sm" type="button" variant="ghost">
            Close
          </Button>
        </div>
        <PhoneFrame>
          {screen === "home" && (
            <PhoneHome onSettings={() => setScreen("settings")} onType={() => openSheet(null)} onVoice={() => setScreen("voice")} recent={recent} />
          )}
          {screen === "settings" && <PhoneSettings onBack={() => setScreen("home")} />}
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
    </div>
  );
}
