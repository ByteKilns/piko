import { Type } from "@google/genai";

import { GEMINI_MODEL_ID, geminiClient } from "@/lib/gemini-client";
import type { RawVoiceExpense } from "@/modules/voice-entry/lib/sanitize-voice-expense";

export type VoiceExpenseContext = {
  categories: { id: string; name: string }[];
  members: { id: string; name: string }[];
  today: string;
};

export async function parseExpenseTranscript(
  transcript: string,
  context: VoiceExpenseContext,
): Promise<RawVoiceExpense> {
  const categoryIds = context.categories.map((c) => c.id);
  const memberIds = context.members.map((m) => m.id);

  const prompt = `You turn a spoken sentence into a structured expense record for a household budget app.

Today's date is ${context.today}.

Categories (id: name):
${context.categories.map((c) => `${c.id}: ${c.name}`).join("\n")}

Household members (id: name):
${context.members.map((m) => `${m.id}: ${m.name}`).join("\n")}

The spoken sentence is:
"${transcript}"

Extract an expense from it. "ownerMemberId" is who the expense is for - use a
member id if a specific person is named or implied (e.g. "I spent" implies the
speaker; assume the first listed member if unclear who is speaking), or the
literal string "shared" if it's a household/shared expense. "paidByMemberId"
is who actually paid - default to the same person as ownerMemberId, or the
first listed member if ownerMemberId is "shared" and no payer is named.
"date" must be YYYY-MM-DD, resolved relative to today's date if the sentence
says "yesterday"/"last Monday"/etc; default to today's date if no date is
mentioned. Set "understood" to false if the sentence doesn't describe a
plausible expense at all (e.g. it's unrelated small talk).`;

  const response = await geminiClient.models.generateContent({
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        properties: {
          amount: { type: Type.NUMBER },
          categoryId: { enum: categoryIds, type: Type.STRING },
          date: { type: Type.STRING },
          note: { type: Type.STRING },
          ownerMemberId: { enum: [...memberIds, "shared"], type: Type.STRING },
          paidByMemberId: { enum: memberIds, type: Type.STRING },
          understood: { type: Type.BOOLEAN },
        },
        required: ["understood", "amount", "categoryId", "date", "note", "ownerMemberId", "paidByMemberId"],
        type: Type.OBJECT,
      },
    },
    contents: prompt,
    model: GEMINI_MODEL_ID,
  });

  return JSON.parse(response.text ?? "{}") as RawVoiceExpense;
}
