import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { requireMobileAuth } from "@/lib/mobile-request";
import { insertCaptureForMember, lastNotesByPayeeForMember, listDraftCapturesForMember } from "@/modules/captures/api/captures";
import { captureJson, payeeKey } from "@/modules/captures/lib/captures";
import { captureSchema } from "@/modules/captures/schemas/capture.schema";

// The signed-in member's eSewa drafts waiting for review, newest first. Each
// carries `lastNote`: the note on the last payment to the same payee they
// approved, or null.
export async function GET(request: NextRequest) {
  const auth = await requireMobileAuth(request);
  if (auth instanceof NextResponse) return auth;

  const [rows, notes] = await Promise.all([listDraftCapturesForMember(auth), lastNotesByPayeeForMember(auth)]);
  return NextResponse.json({
    captures: rows.map((row) => ({ ...captureJson(row), lastNote: notes.get(payeeKey(row.counterparty)) ?? null })),
  });
}

// A transaction the app parsed from a notification. Money going out becomes a
// draft; money coming in is kept as skipped. A notification already stored
// comes back as it is, with `created: false`, so the app alerts only once.
export async function POST(request: NextRequest) {
  const auth = await requireMobileAuth(request);
  if (auth instanceof NextResponse) return auth;

  const parsed = captureSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: { message: "Invalid capture" } }, { status: 400 });
  }

  const { created, row } = await insertCaptureForMember(auth, parsed.data);
  return NextResponse.json({ capture: captureJson(row), created }, { status: created ? 201 : 200 });
}
