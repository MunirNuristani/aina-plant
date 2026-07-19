import type { SensorReading } from "./types";

export const DEFAULT_REPORTING_INTERVAL_SECONDS = 900;

// A reading is stale once it's significantly older than the device's own
// reporting cadence — allow a few missed cycles before flagging it, but
// never call something stale within the first hour regardless of how
// frequently the device is configured to report.
const STALE_CYCLE_MULTIPLIER = 3;
const MIN_STALE_THRESHOLD_SECONDS = 60 * 60;

export function isReadingStale(
  reading: SensorReading,
  reportingIntervalSeconds: number = DEFAULT_REPORTING_INTERVAL_SECONDS,
): boolean {
  const ageSeconds = (Date.now() - new Date(reading.recordedAt).getTime()) / 1000;
  const threshold = Math.max(reportingIntervalSeconds * STALE_CYCLE_MULTIPLIER, MIN_STALE_THRESHOLD_SECONDS);
  return ageSeconds > threshold;
}

export type MoistureLevel = "healthy" | "dry" | "needs-water";

export function moistureLevel(percent: number): MoistureLevel {
  if (percent >= 50) return "healthy";
  if (percent >= 25) return "dry";
  return "needs-water";
}

export const MOISTURE_LEVEL_COPY: Record<MoistureLevel, { label: string; textClass: string; dotClass: string }> = {
  healthy: { label: "Well watered", textClass: "text-success", dotClass: "bg-success" },
  dry: { label: "Getting dry", textClass: "text-warning", dotClass: "bg-warning" },
  "needs-water": { label: "Needs water", textClass: "text-error", dotClass: "bg-error" },
};
