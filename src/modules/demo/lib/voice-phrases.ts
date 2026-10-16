import { addDays } from "@/modules/expenses/lib/expense-view";
import type { ExpenseDraft } from "@/modules/voice-entry/lib/sanitize-voice-expense";

// The demo phone's voice screen: visitors tap one of these instead of
// speaking, and get the answer written here instead of asking Gemini. So no
// stranger's words ever leave the browser, and nothing spends the quota.
// "me" is the visitor (Aarav); "partner" is Sita.
export type VoicePhrase = {
  amount: number;
  category: string;
  daysAgo: 0 | 1;
  note: null | string;
  owner: "me" | "partner" | "shared";
  paidBy: "me" | "partner";
  text: string;
};

export const VOICE_PHRASES: VoicePhrase[] = [
  { amount: 450, category: "Dining Out", daysAgo: 0, note: "Momo with Sita", owner: "shared", paidBy: "me", text: "Momo with Sita, 450 rupees" },
  { amount: 1500, category: "Petrol", daysAgo: 1, note: null, owner: "me", paidBy: "me", text: "Petrol 1,500 yesterday" },
  { amount: 800, category: "Public Transport", daysAgo: 0, note: "Taxi", owner: "shared", paidBy: "partner", text: "Sita paid 800 for the taxi" },
  { amount: 3200, category: "Groceries", daysAgo: 0, note: null, owner: "shared", paidBy: "me", text: "Groceries 3,200, shared" },
  { amount: 500, category: "Personal", daysAgo: 0, note: "Phone recharge", owner: "me", paidBy: "me", text: "Phone recharge 500" },
];

type Context = {
  categories: { id: string; name: string }[];
  currentMemberId: string;
  partnerId: null | string;
  // "YYYY-MM-DD"
  today: string;
};

export function draftForPhrase(phrase: VoicePhrase, ctx: Context): ExpenseDraft {
  const person = (who: "me" | "partner") => (who === "partner" && ctx.partnerId ? ctx.partnerId : ctx.currentMemberId);
  return {
    amount: phrase.amount,
    // Empty when the visitor removed the category: the sheet then asks for one.
    categoryId: ctx.categories.find((c) => c.name === phrase.category)?.id ?? "",
    date: phrase.daysAgo === 1 ? addDays(ctx.today, -1) : ctx.today,
    note: phrase.note,
    ownerMemberId: phrase.owner === "shared" ? null : person(phrase.owner),
    paidByMemberId: person(phrase.paidBy),
  };
}
