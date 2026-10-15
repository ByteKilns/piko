import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { requireMobileAuth } from "@/lib/mobile-request";
import { approveCaptureForMember } from "@/modules/captures/api/captures";
import { approveCaptureSchema } from "@/modules/captures/schemas/capture.schema";
import { ExpenseValidationError } from "@/modules/expenses/api/expense-errors";

// Makes a draft a real expense, with the details as checked on the phone.
export async function POST(request: NextRequest) {
  const auth = await requireMobileAuth(request);
  if (auth instanceof NextResponse) return auth;

  const parsed = approveCaptureSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: { message: "Invalid expense data", fields: parsed.error.flatten() } }, { status: 400 });
  }

  try {
    const created = await approveCaptureForMember(auth, parsed.data.id, parsed.data.expense);
    if (!created) {
      return NextResponse.json({ error: { message: "This payment was already reviewed." } }, { status: 409 });
    }
    return NextResponse.json({ expense: { ...created, amount: Number(created.amount) } });
  } catch (error) {
    if (error instanceof ExpenseValidationError) {
      return NextResponse.json({ error: { message: error.message } }, { status: 400 });
    }
    throw error;
  }
}
