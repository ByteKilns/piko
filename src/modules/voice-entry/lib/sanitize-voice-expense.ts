import { todayISO } from "@/lib/today";

export type RawVoiceExpense = {
  amount: number;
  categoryId: string;
  date: string;
  note: string;
  ownerMemberId: string;
  paidByMemberId: string;
  understood: boolean;
};

export type ExpenseDraft = {
  amount: number;
  categoryId: string;
  date: string;
  note: string | null;
  ownerMemberId: string | null;
  paidByMemberId: string;
};

export type VoiceParseResult = { draft: ExpenseDraft; ok: true } | { ok: false; reason: "not_understood" };

export type VoiceExpenseHouseholdContext = {
  categories: { id: string }[];
  currentMemberId: string;
  members: { id: string }[];
};

const DATE_SHAPE = /^\d{4}-\d{2}-\d{2}$/;

export function sanitizeVoiceExpense(raw: RawVoiceExpense, context: VoiceExpenseHouseholdContext): VoiceParseResult {
  if (!raw.understood || !raw.amount || raw.amount <= 0) {
    return { ok: false, reason: "not_understood" };
  }

  const categoryId = context.categories.some((c) => c.id === raw.categoryId)
    ? raw.categoryId
    : (context.categories[0]?.id ?? "");

  const ownerMemberId =
    raw.ownerMemberId === "shared"
      ? null
      : context.members.some((m) => m.id === raw.ownerMemberId)
        ? raw.ownerMemberId
        : context.currentMemberId;

  const paidByMemberId = context.members.some((m) => m.id === raw.paidByMemberId)
    ? raw.paidByMemberId
    : context.currentMemberId;

  const date = DATE_SHAPE.test(raw.date) ? raw.date : todayISO();

  return {
    draft: {
      amount: raw.amount,
      categoryId,
      date,
      note: raw.note.trim() || null,
      ownerMemberId,
      paidByMemberId,
    },
    ok: true,
  };
}
