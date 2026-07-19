"use server";

import { apiFetch } from "@/lib/api";
import type { ApiError, ApiErrorDetail, CareEvent } from "@/lib/types";

export type CreateCareEventInput = {
  occurredAt: string;
  amount?: number;
  unit?: string;
  notes?: string;
};

export type CreateCareEventResult =
  | { ok: true; careEvent: CareEvent }
  | { ok: false; fieldErrors: Record<string, string>; formError?: string };

// Runs server-side deliberately: the backend has no CORS configuration
// (server-to-server calls are never subject to CORS — only browser-issued
// cross-origin requests are), so a direct client-side fetch from
// LogWateringForm fails outright with a CORS error. Routing through this
// Server Action keeps the actual backend request server-to-server, which
// sidesteps that with no backend change.
//
// Returns a result object rather than throwing — per Next's own guidance
// for expected/validation errors, model them as return values. A thrown
// error crossing the Server Action boundary isn't guaranteed to preserve a
// custom error subclass or its extra fields (React/Next may collapse it to
// a generic message in production), so field-level validation detail has
// to travel back as plain data, not as a thrown error.
export async function createCareEventAction(
  plantId: string,
  input: CreateCareEventInput,
): Promise<CreateCareEventResult> {
  const res = await apiFetch(`/plants/${plantId}/care-events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "WATERING", ...input }),
  });

  if (!res.ok) {
    const body: { error?: ApiError } = await res.json().catch(() => ({}));
    const error = body.error;

    if (res.status === 400 && error?.code === "VALIDATION_ERROR" && Array.isArray(error.details)) {
      const fieldErrors: Record<string, string> = {};
      for (const detail of error.details as ApiErrorDetail[]) {
        fieldErrors[detail.field] = detail.message;
      }
      return { ok: false, fieldErrors, formError: fieldErrors["(root)"] };
    }

    return { ok: false, fieldErrors: {}, formError: error?.message ?? `Failed to log watering (${res.status})` };
  }

  const data: { careEvent: CareEvent } = await res.json();
  return { ok: true, careEvent: data.careEvent };
}
