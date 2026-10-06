"use server";

import { parseExpenseTranscript } from "@/lib/gemini";
import { getCurrentMember, getHouseholdMembers } from "@/lib/session";
import { todayISO } from "@/lib/today";
import { listCategories } from "@/modules/categories/api/categories";
import { sanitizeVoiceExpense, type VoiceParseResult } from "@/modules/voice-entry/lib/sanitize-voice-expense";

export async function parseVoiceEntry(
  transcript: string,
  { householdId, memberId }: { householdId: string; memberId: string },
): Promise<VoiceParseResult> {
  const [categories, members] = await Promise.all([listCategories(householdId), getHouseholdMembers(householdId)]);

  if (categories.length === 0 || members.length === 0) {
    return { ok: false, reason: "not_understood" };
  }

  const categoryOptions = categories.map((c) => ({ id: c.id, name: c.name }));
  const memberOptions = members.map((m) => ({ id: m.id, name: m.user.name }));

  try {
    const raw = await parseExpenseTranscript(transcript, {
      categories: categoryOptions,
      members: memberOptions,
      today: todayISO(),
    });
    return sanitizeVoiceExpense(raw, {
      categories: categoryOptions,
      currentMemberId: memberId,
      members: memberOptions,
    });
  } catch {
    return { ok: false, reason: "not_understood" };
  }
}

export async function parseVoiceEntryAction(transcript: string): Promise<VoiceParseResult> {
  const { householdId, memberId } = await getCurrentMember();
  return parseVoiceEntry(transcript, { householdId, memberId });
}
