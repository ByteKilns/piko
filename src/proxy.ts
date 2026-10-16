import { NextResponse } from "next/server";

import { auth } from "@/auth";

// Open without a session. /demo stays open to signed-in people too, so the
// owner can try their own demo link.
const PUBLIC_PATHS = ["/login", "/demo"];

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const { pathname } = req.nextUrl;

  if (!isLoggedIn && !PUBLIC_PATHS.includes(pathname)) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }
  if (isLoggedIn && pathname === "/login") {
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl));
  }
});

export const config = {
  matcher: ["/((?!api/auth|api/mobile|_next/static|_next/image|favicon.ico).*)"],
};
