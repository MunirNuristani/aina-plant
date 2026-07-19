import { apiFetch } from "./api";
import type { Plant, SensorReading } from "./types";

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
