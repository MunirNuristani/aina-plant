"use server";

import { apiFetch } from "@/lib/api";
import type { ApiError, ApiErrorDetail, CareEvent } from "@/lib/types";

export type CreateCareEventInput = {
  occurredAt: string;
  amount?: number;
  unit?: string;
  notes?: string;
};

// occurredAt/notes always sent (notes is the only field the backend lets
// you clear via PATCH — an explicit "" — so it's never omitted). amount and
// unit are omit-to-leave-unchanged: the backend's update service only
// touches a field when the key is present at all, and its validation
// schema has no null/empty escape hatch for either (amount must be a
// non-negative number, unit must be a non-empty string, if provided) — so
// there is currently no way to CLEAR an already-set amount or unit through
// this API, only to change it to a different value. See the edit form's
// helper text, which says this rather than pretending otherwise.
export type UpdateCareEventInput = {
  occurredAt: string;
  amount?: number;
  unit?: string;
  notes: string;
};

export type CareEventActionResult =
  | { ok: true; careEvent: CareEvent }
  | { ok: false; fieldErrors: Record<string, string>; formError?: string };

async function parseErrorResult(res: Response, fallbackVerb: string): Promise<CareEventActionResult> {
  const body: { error?: ApiError } = await res.json().catch(() => ({}));
  const error = body.error;

  if (res.status === 400 && error?.code === "VALIDATION_ERROR" && Array.isArray(error.details)) {
    const fieldErrors: Record<string, string> = {};
    for (const detail of error.details as ApiErrorDetail[]) {
      fieldErrors[detail.field] = detail.message;
    }
    return { ok: false, fieldErrors, formError: fieldErrors["(root)"] };
  }

  return { ok: false, fieldErrors: {}, formError: error?.message ?? `Failed to ${fallbackVerb} (${res.status})` };
}

// Runs server-side deliberately: the backend has no CORS configuration, so
// a direct client-side fetch from a Client Component fails outright (see
// LogWateringForm / createCareEventAction, which hit this first). Returns
// a result object rather than throwing, per Next's guidance for expected
// errors — see createCareEventAction's comment for the full reasoning.
export async function createCareEventAction(
  plantId: string,
  input: CreateCareEventInput,
): Promise<CareEventActionResult> {
  const res = await apiFetch(`/plants/${plantId}/care-events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "WATERING", ...input }),
  });

  if (!res.ok) {
    return parseErrorResult(res, "log watering");
  }

  const data: { careEvent: CareEvent } = await res.json();
  return { ok: true, careEvent: data.careEvent };
}

export async function updateCareEventAction(
  plantId: string,
  careEventId: string,
  input: UpdateCareEventInput,
): Promise<CareEventActionResult> {
  const res = await apiFetch(`/plants/${plantId}/care-events/${careEventId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    return parseErrorResult(res, "update watering");
  }

  const data: { careEvent: CareEvent } = await res.json();
  return { ok: true, careEvent: data.careEvent };
}

export type DeleteCareEventResult = { ok: true } | { ok: false; error: string };

export async function deleteCareEventAction(plantId: string, careEventId: string): Promise<DeleteCareEventResult> {
  const res = await apiFetch(`/plants/${plantId}/care-events/${careEventId}`, { method: "DELETE" });

  if (!res.ok) {
    const body: { error?: ApiError } = await res.json().catch(() => ({}));
    return { ok: false, error: body.error?.message ?? `Failed to delete watering (${res.status})` };
  }

  return { ok: true };
}
