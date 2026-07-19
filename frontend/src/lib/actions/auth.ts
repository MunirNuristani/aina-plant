"use server";

import { redirect } from "next/navigation";
import { apiUrl } from "@/lib/api";
import { createSession, deleteSession } from "@/lib/session";
import type { ApiError, ApiErrorDetail, User } from "@/lib/types";

export type AuthActionResult =
  | { ok: true }
  | { ok: false; fieldErrors: Record<string, string>; formError?: string };

// signupAction/loginAction deliberately do NOT call redirect() themselves,
// unlike logoutAction below. They're invoked imperatively from a client
// component (LoginForm/SignupForm), wrapped in try/catch, the same way
// LogWateringForm calls createCareEventAction -- redirect() throws a
// special NEXT_REDIRECT value that a manual catch block would otherwise
// swallow as a generic error. logoutAction is different: it's bound
// directly via <form action={logoutAction}>, the native Server Action
// form-binding path, where the framework itself handles the thrown
// redirect correctly.

async function parseAuthErrorResult(res: Response, fallbackVerb: string): Promise<AuthActionResult> {
  const body: { error?: ApiError } = await res.json().catch(() => ({}));
  const error = body.error;

  if (res.status === 400 && error?.code === "VALIDATION_ERROR" && Array.isArray(error.details)) {
    const fieldErrors: Record<string, string> = {};
    for (const detail of error.details as ApiErrorDetail[]) {
      fieldErrors[detail.field] = detail.message;
    }
    return { ok: false, fieldErrors, formError: fieldErrors["(root)"] };
  }

  // Covers 401 (bad credentials), 409 (email taken), and 429 (rate
  // limited) alike -- none of these have a field-error shape, so the
  // backend's message is shown as a form-level error.
  return {
    ok: false,
    fieldErrors: {},
    formError: error?.message ?? `Failed to ${fallbackVerb} (${res.status})`,
  };
}

export type SignupInput = { email: string; password: string; name?: string };

// Runs server-side deliberately, same reasoning as care-events.ts's
// actions: the backend has no CORS configuration, so a direct client-side
// fetch would fail outright. Calls the backend directly (not through
// apiFetch) since signup/login are themselves how a session begins --
// there's no token yet to attach.
export async function signupAction(input: SignupInput): Promise<AuthActionResult> {
  const res = await fetch(apiUrl("/auth/signup"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    return parseAuthErrorResult(res, "sign up");
  }

  const data: { user: User; token: string } = await res.json();
  await createSession(data.token);
  return { ok: true };
}

export type LoginInput = { email: string; password: string };

export async function loginAction(input: LoginInput): Promise<AuthActionResult> {
  const res = await fetch(apiUrl("/auth/login"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    return parseAuthErrorResult(res, "log in");
  }

  const data: { user: User; token: string } = await res.json();
  await createSession(data.token);
  return { ok: true };
}

// A Server Action (not a plain link) because deleting the session cookie
// requires cookies().delete(), which only works inside a Server Action or
// Route Handler -- never during Server Component render. Used as a
// <form action={logoutAction}> in site-header.tsx.
export async function logoutAction(): Promise<void> {
  await deleteSession();
  redirect("/login");
}
