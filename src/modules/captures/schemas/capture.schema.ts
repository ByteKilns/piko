import { z } from "zod";

import { expenseSchema } from "@/modules/expenses/schemas/expense.schema";

// The app's TxnKind names (mobile/lib/esewa/models.dart).
const kinds = ["payment", "transfer", "topup", "billPay", "load", "cashback", "refund", "unknown"] as const;

// One transaction the app parsed from a notification. The server decides its
// status from the direction, so the app can't file anything as approved.
export const captureSchema = z.object({
  amount: z.number().positive(),
  category: z.string().min(1),
  categoryConfidence: z.number().min(0).max(1),
  counterparty: z.string().trim().min(1).nullable(),
  direction: z.enum(["debit", "credit"]),
  kind: z.enum(kinds),
  occurredAt: z.iso.datetime(),
  rawText: z.string(),
  refId: z.string().trim().min(1).nullable(),
  source: z.string().min(1),
});

export const captureEventSchema = z.object({
  key: z.string(),
  postedAt: z.iso.datetime(),
  source: z.string().min(1),
  text: z.string(),
  title: z.string(),
});

export const captureRulesSchema = z.object({
  rules: z.array(z.object({ categoryId: z.string().uuid(), counterparty: z.string().trim().min(1) })).max(500),
});

export const approveCaptureSchema = z.object({ expense: expenseSchema, id: z.string().uuid() });

export const captureIdSchema = z.object({ id: z.string().uuid() });

export type CaptureInput = z.infer<typeof captureSchema>;
export type CaptureEventInput = z.infer<typeof captureEventSchema>;
export type CaptureRuleInput = z.infer<typeof captureRulesSchema>["rules"][number];
