"use server";

import { apiFetch } from "@/lib/api";
import type { ApiError, ApiErrorDetail, Plant } from "@/lib/types";

export type CreatePlantInput = {
  name: string;
  commonName?: string;
  scientificName?: string;
  location?: string;
  notes?: string;
  potSize?: string;
  soilType?: string;
};

export type PlantActionResult =
  | { ok: true; plant: Plant }
  | { ok: false; fieldErrors: Record<string, string>; formError?: string };

async function parseErrorResult(res: Response, fallbackVerb: string): Promise<PlantActionResult> {
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

export async function createPlantAction(input: CreatePlantInput): Promise<PlantActionResult> {
  const res = await apiFetch("/plants", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    return parseErrorResult(res, "create plant");
  }

  const data: { plant: Plant } = await res.json();
  return { ok: true, plant: data.plant };
}
