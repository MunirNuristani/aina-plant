import { apiFetch } from "./api";
import type { CareEvent, Plant, SensorReading } from "./types";

export async function getPlants(): Promise<Plant[]> {
  const res = await apiFetch("/plants", { cache: "no-store" });

  if (!res.ok) {
    throw new Error(`Failed to load plants (${res.status})`);
  }

  const data: { plants: Plant[] } = await res.json();
  return data.plants;
}

export async function getPlant(plantId: string): Promise<Plant | null> {
  const res = await apiFetch(`/plants/${plantId}`, { cache: "no-store" });

  if (res.status === 404) {
    return null;
  }

  if (!res.ok) {
    throw new Error(`Failed to load plant ${plantId} (${res.status})`);
  }

  const data: { plant: Plant } = await res.json();
  return data.plant;
}

export async function getLatestReading(plantId: string): Promise<SensorReading | null> {
  const res = await apiFetch(`/plants/${plantId}/readings/latest`, {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Failed to load latest reading for plant ${plantId} (${res.status})`);
  }

  const data: { reading: SensorReading | null } = await res.json();
  return data.reading;
}

// Sorted oldest-first (sort=asc — for plotting left-to-right). Capped at the
// API's own limit=1000 ceiling; see lib/moisture.ts's module comment for what
// that means for high-frequency devices.
export async function getReadingHistory(
  plantId: string,
  range: { start: Date; end: Date },
): Promise<SensorReading[]> {
  const params = new URLSearchParams({
    start: range.start.toISOString(),
    end: range.end.toISOString(),
    sort: "asc",
    limit: "1000",
  });
  const res = await apiFetch(`/plants/${plantId}/readings?${params}`, { cache: "no-store" });

  if (!res.ok) {
    throw new Error(`Failed to load reading history for plant ${plantId} (${res.status})`);
  }

  const data: { readings: SensorReading[] } = await res.json();
  return data.readings;
}

// Newest occurredAt first — the API's own documented ordering; no
// client-side sort needed.
export async function getCareEvents(plantId: string): Promise<CareEvent[]> {
  const res = await apiFetch(`/plants/${plantId}/care-events`, { cache: "no-store" });

  if (!res.ok) {
    throw new Error(`Failed to load care events for plant ${plantId} (${res.status})`);
  }

  const data: { careEvents: CareEvent[] } = await res.json();
  return data.careEvents;
}
