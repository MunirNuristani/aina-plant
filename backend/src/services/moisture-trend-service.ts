import { prisma } from '../db';
import { NotFoundError } from '../http/errors';

// Percentage-point change within which two readings are considered "the
// same" rather than a real increase/decrease -- moisture sensors are
// noisy enough that a 1-2 point wobble between readings is measurement
// noise, not a genuine trend. Configurable per call (see
// analyzeMoistureTrend()'s stableTolerancePercent parameter); this is
// only the default.
export const DEFAULT_STABLE_TOLERANCE_PERCENT = 3;

// How far back (from now) to look for readings by default when a caller
// doesn't specify their own window. 24 hours is long enough to smooth
// over a single watering's immediate spike while still being "recent."
export const DEFAULT_ANALYSIS_WINDOW_HOURS = 24;

// The strict mathematical minimum to compute a change at all is 2 readings
// (earliest and latest). This is set higher on purpose: with exactly 2
// readings, a single noisy outlier at either end would swing the verdict
// with no corroborating evidence -- "sparse data does not produce false
// certainty" (see this module's tests). 3 is still a low bar, not a
// statistical guarantee, but means at least one reading exists strictly
// between the endpoints.
export const DEFAULT_MIN_READINGS_FOR_TREND = 3;

export type MoistureTrendDirection = 'INCREASING' | 'DECREASING' | 'STABLE' | 'INSUFFICIENT_DATA';

export type MoistureReadingPoint = {
  recordedAt: Date;
  moisturePercent: number;
};

export type MoistureTrendResult = {
  direction: MoistureTrendDirection;

  // How many *valid* readings the verdict is based on -- not necessarily
  // how many were passed in, if some were excluded (see
  // analyzeMoistureTrend()'s validity check).
  readingCount: number;

  // Undefined when direction is INSUFFICIENT_DATA -- there is deliberately
  // no fabricated "change" to report when there isn't enough evidence for
  // one. When present, these are the actual evidence behind the verdict:
  // the two readings compared and the resulting change.
  earliest?: MoistureReadingPoint;
  latest?: MoistureReadingPoint;
  changePercent?: number;
};

// A reading is only usable for trend analysis if moisturePercent is an
// actual finite number in the sensor's real range. The database already
// enforces [0, 100] via a CHECK constraint (see
// SensorReading_moisturePercent_range in prisma/schema.prisma), so this
// should never actually catch anything in practice -- but this function
// doesn't assume its caller only ever hands it real database rows (unit
// tests deliberately feed it invalid values directly; see
// moisture-trend-service.test.ts), and defends against NaN/Infinity the
// same way SoilMoistureSensor's firmware counterpart never trusts a
// reading is real just because the type system says "number".
function isValidReading(point: MoistureReadingPoint): boolean {
  return (
    Number.isFinite(point.moisturePercent) &&
    point.moisturePercent >= 0 &&
    point.moisturePercent <= 100
  );
}

// Pure calculation: given a set of readings, decides whether moisture is
// rising, falling, stable, or whether there simply isn't enough valid,
// recent data to say. Takes plain data in and returns a plain result out
// -- no database access, no I/O -- so it's fully unit-testable with
// synthetic reading arrays covering every state and edge case (see
// moisture-trend-service.test.ts) rather than only ever trusted because
// it "looks right" against real data.
//
// Deliberately compares only the earliest and latest valid reading (not a
// regression line or moving average) -- "earliest-to-latest change" is
// the specified calculation, simple and easy to explain to a user ("your
// soil moisture went from 42% to 61% over the last day").
export function analyzeMoistureTrend(
  readings: MoistureReadingPoint[],
  stableTolerancePercent: number = DEFAULT_STABLE_TOLERANCE_PERCENT,
  minReadingsForTrend: number = DEFAULT_MIN_READINGS_FOR_TREND,
): MoistureTrendResult {
  const valid = readings.filter(isValidReading);

  if (valid.length < minReadingsForTrend) {
    return { direction: 'INSUFFICIENT_DATA', readingCount: valid.length };
  }

  // Sorted defensively rather than trusting the caller already ordered
  // them -- "earliest" and "latest" must reflect actual measurement time,
  // not array order.
  const sorted = [...valid].sort((a, b) => a.recordedAt.getTime() - b.recordedAt.getTime());
  const earliest = sorted[0];
  const latest = sorted[sorted.length - 1];
  const changePercent = latest.moisturePercent - earliest.moisturePercent;

  let direction: MoistureTrendDirection;
  if (Math.abs(changePercent) <= stableTolerancePercent) {
    direction = 'STABLE';
  } else if (changePercent > 0) {
    direction = 'INCREASING';
  } else {
    direction = 'DECREASING';
  }

  return { direction, readingCount: sorted.length, earliest, latest, changePercent };
}

// Loads a plant's readings from the last `windowHours` and hands them to
// analyzeMoistureTrend(). This is the only part of the module that
// touches the database -- kept separate from the calculation above
// specifically so the calculation itself can be unit-tested without one.
export async function getMoistureTrendForPlant(
  plantId: string,
  userId: string,
  windowHours: number = DEFAULT_ANALYSIS_WINDOW_HOURS,
  stableTolerancePercent: number = DEFAULT_STABLE_TOLERANCE_PERCENT,
): Promise<MoistureTrendResult> {
  const plant = await prisma.plant.findFirst({ where: { id: plantId, userId } });
  if (!plant) {
    throw new NotFoundError('Plant not found');
  }

  const windowStart = new Date(Date.now() - windowHours * 60 * 60 * 1000);

  const readings = await prisma.sensorReading.findMany({
    where: { plantId, recordedAt: { gte: windowStart } },
    select: { recordedAt: true, moisturePercent: true },
    orderBy: { recordedAt: 'asc' },
  });

  return analyzeMoistureTrend(readings, stableTolerancePercent);
}
