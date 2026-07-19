import { cookies } from "next/headers";
import { decodeJwt } from "jose";

const SESSION_COOKIE = "aina_session";

// 30 days -- matches the backend's JWT expiry (see backend/src/lib/jwt.ts's
// JWT_EXPIRES_IN). The cookie and the token it holds should expire
// together; a cookie that outlives its token would just mean apiFetch
// starts getting 401s from an already-invalid token instead of the user
// being cleanly signed out.
const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

// Only callable from a Server Action or Route Handler (`cookies().set()`
// is not supported during Server Component render -- see next/headers'
// cookies() docs).
export async function createSession(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

// Safe to call from a Server Component (read-only) as well as a Server
// Action/Route Handler.
export async function getSession(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE)?.value ?? null;
}

// Only callable from a Server Action or Route Handler, same restriction as
// createSession.
export async function deleteSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

// Decodes (does NOT verify) the session token's claims, for display
// purposes only (site-header.tsx's "logged in as ..."). Never use this for
// an access-control decision -- every route that actually reads/writes
// data is independently verified server-side (proxy.ts's full signature
// check, and the backend re-verifying on every request), so a forged
// cookie can at worst show the wrong email in the header, never grant
// access to anything.
export async function getSessionEmail(): Promise<string | null> {
  const token = await getSession();
  if (!token) {
    return null;
  }

  try {
    const claims = decodeJwt(token);
    return typeof claims.email === "string" ? claims.email : null;
  } catch {
    return null;
  }
}
