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

// No aggregation/downsampling is performed anywhere in this module — every
// point plotted is a real reading, never a bucket average. The backend caps
// `GET /readings` at limit=1000 (see lib/plants.ts's getReadingHistory);
// at the default 900s (15 min) reporting interval that's ~672 points for a
// full 7-day window, comfortably under the cap, so a 7-day chart shows every
// reading a device at the default cadence produced. A device configured to
// report much more frequently than the default would have its 7-day history
// silently truncated to the most recent 1000 readings by the API itself
// (sort=asc, so truncation drops the OLDEST readings in range, not the
// newest) rather than downsampled — if that ever becomes a real scenario,
// bucketed averaging belongs here, not silently in the chart component.
export type ChartPoint = { time: number; moisturePercent: number | null };

// A gap this many multiples of the device's reporting interval (floored at
// MIN_STALE_THRESHOLD_SECONDS, same reasoning as isReadingStale above) is
// treated as "the device stopped reporting for a while," not just normal
// jitter between readings — a synthetic null point is inserted at the
// midpoint so the chart line breaks there instead of drawing a continuous
// slope across dead air.
export function buildChartSeries(
  readings: SensorReading[],
  reportingIntervalSeconds: number = DEFAULT_REPORTING_INTERVAL_SECONDS,
): ChartPoint[] {
  const gapThresholdMs = Math.max(reportingIntervalSeconds * STALE_CYCLE_MULTIPLIER, MIN_STALE_THRESHOLD_SECONDS) * 1000;
  const points: ChartPoint[] = [];

  for (const reading of readings) {
    const time = new Date(reading.recordedAt).getTime();
    const previous = points.at(-1);

    if (previous && previous.moisturePercent !== null && time - previous.time > gapThresholdMs) {
      points.push({ time: previous.time + (time - previous.time) / 2, moisturePercent: null });
    }

    points.push({ time, moisturePercent: reading.moisturePercent });
  }

  return points;
}
