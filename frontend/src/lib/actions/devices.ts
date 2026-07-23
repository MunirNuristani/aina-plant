"use server";

import { apiFetch } from "@/lib/api";
import type { ApiError, ApiErrorDetail, Device } from "@/lib/types";

export type RegisterDeviceInput = { name: string; identifier: string };

export type RegisterDeviceResult =
  | { ok: true; device: Device; credential: string }
  | { ok: false; fieldErrors: Record<string, string>; formError?: string };

async function parseFieldErrorResult(
  res: Response,
  fallbackVerb: string,
): Promise<{ ok: false; fieldErrors: Record<string, string>; formError?: string }> {
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

export async function registerDeviceAction(input: RegisterDeviceInput): Promise<RegisterDeviceResult> {
  const res = await apiFetch("/devices", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    return parseFieldErrorResult(res, "register device");
  }

  const data: { device: Device; credential: string } = await res.json();
  return { ok: true, device: data.device, credential: data.credential };
}

export type RotateDeviceCredentialResult =
  | { ok: true; device: Device; credential: string }
  | { ok: false; error: string };

// Issues a fresh device credential without touching the device's id,
// identifier, or plant assignment -- the mechanism for "this
// already-registered device just needs new Wi-Fi" (moved, router
// changed), since the original credential is only ever shown once and
// isn't stored in plaintext anywhere to hand out again. See
// device-detail-controls.tsx's "Reconfigure Wi-Fi" button.
export async function rotateDeviceCredentialAction(deviceId: string): Promise<RotateDeviceCredentialResult> {
  const res = await apiFetch(`/devices/${deviceId}/rotate-credential`, { method: "POST" });

  if (!res.ok) {
    const body: { error?: ApiError } = await res.json().catch(() => ({}));
    return { ok: false, error: body.error?.message ?? `Failed to rotate credential (${res.status})` };
  }

  const data: { device: Device; credential: string } = await res.json();
  return { ok: true, device: data.device, credential: data.credential };
}

export type SimpleActionResult = { ok: true } | { ok: false; error: string };

async function parseSimpleErrorResult(res: Response, fallbackVerb: string): Promise<SimpleActionResult> {
  const body: { error?: ApiError } = await res.json().catch(() => ({}));
  return { ok: false, error: body.error?.message ?? `Failed to ${fallbackVerb} (${res.status})` };
}

export async function assignDeviceAction(
  deviceId: string,
  plantId: string,
  reassign = false,
): Promise<SimpleActionResult> {
  const res = await apiFetch(`/devices/${deviceId}/assign`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ plantId, reassign }),
  });

  if (!res.ok) {
    return parseSimpleErrorResult(res, "assign device");
  }

  return { ok: true };
}

// PATCH /devices/:id with an explicit null plantId -- the backend accepts
// only that literal value here (never an arbitrary plant id), so this can
// never be used to assign a device to a plant it doesn't already belong
// to -- see backend/src/validation/device.ts's comment on why.
export async function unassignDeviceAction(deviceId: string): Promise<SimpleActionResult> {
  const res = await apiFetch(`/devices/${deviceId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ plantId: null }),
  });

  if (!res.ok) {
    return parseSimpleErrorResult(res, "unassign device");
  }

  return { ok: true };
}

export async function setDeviceEnabledAction(deviceId: string, enabled: boolean): Promise<SimpleActionResult> {
  const res = await apiFetch(`/devices/${deviceId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ enabled }),
  });

  if (!res.ok) {
    return parseSimpleErrorResult(res, "update device");
  }

  return { ok: true };
}
