import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { isDemoEmail } from "@/lib/demo-account";
import { signMobileToken } from "@/lib/mobile-auth";
import { verifyCredentials } from "@/lib/verify-credentials";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email : undefined;
  const password = typeof body?.password === "string" ? body.password : undefined;

  if (!email || !password) {
    return NextResponse.json({ error: { message: "Email and password are required" } }, { status: 400 });
  }
  // Demo accounts stay on the website: no token means no mobile routes,
  // including the Gemini-backed voice one.
  if (isDemoEmail(email)) {
    return NextResponse.json({ error: { message: "Demo accounts can't sign in to the app" } }, { status: 403 });
  }

  const user = await verifyCredentials(email, password);
  if (!user) {
    return NextResponse.json({ error: { message: "Invalid email or password" } }, { status: 401 });
  }

  const token = await signMobileToken(user.id);
  return NextResponse.json({ token });
}
