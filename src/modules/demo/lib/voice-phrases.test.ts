import { describe, expect, it } from "vitest";

import { DEFAULT_CATEGORIES } from "@/modules/categories/lib/default-categories";
import { expenseSchema } from "@/modules/expenses/schemas/expense.schema";

import { draftForPhrase, VOICE_PHRASES } from "./voice-phrases";

const ME = "11111111-1111-4111-8111-111111111111";
const PARTNER = "22222222-2222-4222-8222-222222222222";
const categories = DEFAULT_CATEGORIES.map((c, i) => ({ id: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`, name: c.name }));
const ctx = { categories, currentMemberId: ME, partnerId: PARTNER, today: "2026-10-15" };

function phrase(text: string) {
  const found = VOICE_PHRASES.find((p) => p.text === text);
  if (!found) throw new Error(`No phrase "${text}"`);
  return found;
}

describe("VOICE_PHRASES", () => {
  it("offers the five phrases from the design", () => {
    expect(VOICE_PHRASES.map((p) => p.text)).toEqual([
      "Momo with Sita, 450 rupees",
      "Petrol 1,500 yesterday",
      "Sita paid 800 for the taxi",
      "Groceries 3,200, shared",
      "Phone recharge 500",
    ]);
  });

  it.each(VOICE_PHRASES.map((p) => p.text))("turns %s into an expense a real save would accept", (text) => {
    const draft = draftForPhrase(phrase(text), ctx);
    expect(expenseSchema.safeParse({ ...draft, note: draft.note ?? undefined }).success).toBe(true);
  });
});

describe("draftForPhrase", () => {
  it("knows who paid, who it was for, and the day", () => {
    expect(draftForPhrase(phrase("Sita paid 800 for the taxi"), ctx)).toMatchObject({
      amount: 800,
      date: "2026-10-15",
      ownerMemberId: null,
      paidByMemberId: PARTNER,
    });
    expect(draftForPhrase(phrase("Petrol 1,500 yesterday"), ctx)).toMatchObject({
      amount: 1500,
      date: "2026-10-14",
      ownerMemberId: ME,
      paidByMemberId: ME,
    });
  });

  it("leaves the category empty when the household no longer has it", () => {
    expect(draftForPhrase(phrase("Phone recharge 500"), { ...ctx, categories: [] }).categoryId).toBe("");
  });
});
