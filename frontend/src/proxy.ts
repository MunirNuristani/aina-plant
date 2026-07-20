import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

// Shared contract with backend/src/lib/jwt.ts: both sides sign/verify HS256
// against the same JWT_SECRET with the same claim shape ({ sub, email }).
// This file uses `jose` (not the backend's `jsonwebtoken`) because it runs
// here, in proxy.ts -- which this Next.js version (16.2.10) defaults to the
// Node.js runtime for, making full signature verification possible, not
// just a "cookie exists" presence check. The Express backend remains the
// authoritative enforcer regardless -- every route independently
// re-verifies the token -- so this is a fast UX-layer redirect, defense in
// depth, not the only check.
const SESSION_COOKIE = "aina_session";

async function isValidSession(token: string | undefined): Promise<boolean> {
  if (!token) {
    return false;
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("Missing JWT_SECRET environment variable.");
  }

  try {
    await jwtVerify(token, new TextEncoder().encode(secret), { algorithms: ["HS256"] });
    return true;
  } catch {
    return false;
  }
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const token = request.cookies.get(SESSION_COOKIE)?.value;

  if (!(await isValidSession(token))) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/plants",
    "/plants/:path*",
    "/devices",
    "/devices/:path*",
    "/alerts",
    "/alerts/:path*",
    "/settings",
    "/settings/:path*",
    "/welcome",
  ],
};
