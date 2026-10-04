import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { requireMobileAuth } from "@/lib/mobile-request";
import { activityActor } from "@/modules/activity/api/activity";
import { ExpenseValidationError } from "@/modules/expenses/api/expense-errors";
import { createExpenseForHousehold, listRecentExpensesForHousehold } from "@/modules/expenses/api/expenses.actions";
import { expenseSchema } from "@/modules/expenses/schemas/expense.schema";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

export async function GET(request: NextRequest) {
  const auth = await requireMobileAuth(request);
  if (auth instanceof NextResponse) return auth;

  const limitParam = Number(request.nextUrl.searchParams.get("limit"));
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, MAX_LIMIT) : DEFAULT_LIMIT;

  const rows = await listRecentExpensesForHousehold(auth.householdId, limit);

  return NextResponse.json({
    expenses: rows.map((row) => ({ ...row, amount: Number(row.amount) })),
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireMobileAuth(request);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => null);
  const parsed = expenseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: { message: "Invalid expense data", fields: parsed.error.flatten() } }, { status: 400 });
  }

  try {
    const created = await createExpenseForHousehold(parsed.data, activityActor(auth, "mobile"));
    return NextResponse.json({ expense: { ...created, amount: Number(created.amount) } }, { status: 201 });
  } catch (error) {
    if (error instanceof ExpenseValidationError) {
      return NextResponse.json({ error: { message: error.message } }, { status: 400 });
    }
    throw error;
  }
}
