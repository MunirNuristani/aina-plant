import { env } from "./env";
import { getSession } from "./session";

export function apiUrl(path: string): string {
  return `${env.apiUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

// Attaches the session cookie's JWT as a Bearer token when present -- still
// server-side only (getSession() reads next/headers' cookies()), so this
// never involves CORS. Every plant/device/analytics route now requires it;
// callers that don't have a session yet (signup/login themselves) bypass
// this and call fetch() directly against apiUrl() instead (see
// lib/actions/auth.ts).
export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const token = await getSession();

  if (!token) {
    return fetch(apiUrl(path), init);
  }

  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${token}`);

  return fetch(apiUrl(path), { ...init, headers });
}
