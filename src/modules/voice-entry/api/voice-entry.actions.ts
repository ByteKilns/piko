"use server";

import { assertNotDemo } from "@/lib/demo-account";
import { getCurrentMember } from "@/lib/session";
import type { VoiceParseResult } from "@/modules/voice-entry/lib/sanitize-voice-expense";

import { parseVoiceEntry } from "./voice-entry";

export async function parseVoiceEntryAction(transcript: string): Promise<VoiceParseResult> {
  const member = await getCurrentMember();
  // Strangers' words must never reach Gemini, or spend its quota.
  assertNotDemo(member);
  return parseVoiceEntry(transcript, { householdId: member.householdId, memberId: member.memberId });
}
