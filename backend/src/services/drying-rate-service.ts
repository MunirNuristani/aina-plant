import { prisma } from '../db';
import { NotFoundError } from '../http/errors';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

// How far back (from now) to look by default when a caller doesn't
// specify their own period. A week is long enough to typically span
// several watering cycles, which matters since this analysis reports one
// result per watering-bounded period, not just one overall number.
export const DEFAULT_ANALYSIS_PERIOD_DAYS = 7;

// A gap this large between two consecutive readings within a period means
// something (the device offline, Wi-Fi down, ...) interrupted continuous
// monitoring -- the true moisture path between those two points is
// unknown, not a straight line. A default Device reports every 900
// seconds (15 minutes; see Device.reportingIntervalSeconds's default in
// prisma/schema.prisma), so a 6-hour gap already represents roughly 24
// consecutive missed reports -- clearly abnormal, not routine jitter.
export const DEFAULT_MAX_GAP_HOURS = 6;

// Mirrors moisture-trend-service's DEFAULT_MIN_READINGS_FOR_TREND and the
// same reasoning: 2 readings is the bare mathematical minimum to compute
// a change, but leaves zero corroborating evidence against a single noisy
// outlier. 3 means at least one reading exists strictly between the
// endpoints being compared.
export const DEFAULT_MIN_READINGS_PER_PERIOD = 3;

export type DryingRateState = 'VALID' | 'LOW_CONFIDENCE' | 'INSUFFICIENT_DATA' | 'NOT_DRYING';

export type MoistureReadingPoint = {
  recordedAt: Date;
  moisturePercent: number;
};

export type WateringEventPoint = {
  occurredAt: Date;
};

export type DryingPeriodResult = {
  state: DryingRateState;

  // This period's own boundaries -- a watering event (or the overall
  // analysis window's start/end) on each side, distinct from
  // DryingRateAnalysis.analysisPeriodStart/End below, which is the full
  // requested window before it got split.
  periodStart: Date;
  periodEnd: Date;

  // How many valid readings fell inside this specific period -- not the
  // total across all periods.
  readingCount: number;

  // Undefined unless state is VALID or LOW_CONFIDENCE -- a magnitude
  // (always >= 0: "declining at 2.3%/hour"), not a signed delta. There is
  // deliberately no fabricated rate for INSUFFICIENT_DATA or NOT_DRYING.
  ratePercentPerHour?: number;

  // True if a gap larger than maxGapHours was found between two
  // consecutive readings inside this period -- what pushes an otherwise
  // computable period from VALID down to LOW_CONFIDENCE (see
  // analyzeDryingRate()). Reported even when the period's state is
  // INSUFFICIENT_DATA/NOT_DRYING, since it's still useful context.
  hasGap: boolean;
};

export type DryingRateAnalysis = {
  // The full requested window, echoed back -- see the "analysis period is
  // returned" acceptance criterion. Each individual DryingPeriodResult's
  // own periodStart/End is a sub-range of this.
  analysisPeriodStart: Date;
  analysisPeriodEnd: Date;

  // Always "percent_per_hour" today -- included explicitly (rather than
  // leaving it implicit) so a caller never has to assume which unit
  // ratePercentPerHour is in. A percent-per-day figure is a trivial ×24
  // away for any caller that wants one; not worth a second unit/field.
  unit: 'percent_per_hour';

  // One entry per watering-bounded period within the analysis window, in
  // chronological order -- see "watering events divide analysis periods".
  // Zero watering events means exactly one period spanning the whole
  // window.
  periods: DryingPeriodResult[];
};

function isValidReading(point: MoistureReadingPoint): boolean {
  return (
    Number.isFinite(point.moisturePercent) &&
    point.moisturePercent >= 0 &&
    point.moisturePercent <= 100
  );
}

function analyzeSinglePeriod(
  readings: MoistureReadingPoint[],
  periodStart: Date,
  periodEnd: Date,
  maxGapHours: number,
  minReadingsPerPeriod: number,
): DryingPeriodResult {
  if (readings.length < minReadingsPerPeriod) {
    return {
      state: 'INSUFFICIENT_DATA',
      periodStart,
      periodEnd,
      readingCount: readings.length,
      hasGap: false,
    };
  }

  let hasGap = false;
  for (let i = 1; i < readings.length; i++) {
    const gapHours =
      (readings[i].recordedAt.getTime() - readings[i - 1].recordedAt.getTime()) / HOUR_MS;
    if (gapHours > maxGapHours) {
      hasGap = true;
      break;
    }
  }

  const earliest = readings[0];
  const latest = readings[readings.length - 1];
  const changePercent = latest.moisturePercent - earliest.moisturePercent;

  // "Increasing moisture is not mislabeled as drying" -- any non-negative
  // change (increasing OR flat) is not a drying period at all, and gets
  // no rate.
  if (changePercent >= 0) {
    return { state: 'NOT_DRYING', periodStart, periodEnd, readingCount: readings.length, hasGap };
  }

  const durationHours = (latest.recordedAt.getTime() - earliest.recordedAt.getTime()) / HOUR_MS;
  // Guards against readings that share an identical timestamp (duration
  // 0) producing a divide-by-zero (Infinity) rate -- treated the same as
  // not having enough evidence, since a rate needs elapsed time to mean
  // anything.
  if (durationHours <= 0) {
    return {
      state: 'INSUFFICIENT_DATA',
      periodStart,
      periodEnd,
      readingCount: readings.length,
      hasGap,
    };
  }

  const ratePercentPerHour = Math.abs(changePercent) / durationHours;

  return {
    state: hasGap ? 'LOW_CONFIDENCE' : 'VALID',
    periodStart,
    periodEnd,
    readingCount: readings.length,
    ratePercentPerHour,
    hasGap,
  };
}

// Pure calculation: given readings and watering events already loaded for
// some window, splits that window into watering-bounded periods and
// estimates a drying rate for each. No database access, no I/O -- fully
// unit-testable with synthetic data covering every state (see
// drying-rate-service.test.ts) rather than only ever trusted because it
// "looks right" against real data.
//
// A watering event always splits a period, regardless of how large or
// small the gap around it is -- watering physically resets the moisture
// level, so the "continuous decline" assumption is broken there no matter
// what the readings show. A large *time* gap between readings does NOT
// split a period on its own; it instead lowers that period's confidence
// (see analyzeSinglePeriod()) -- these are different kinds of
// discontinuity and get different treatment, matching "excessive data
// gaps invalidate or lower confidence" (either is acceptable; this
// module chooses "lower confidence" so a caller still gets a number, just
// flagged, rather than losing the period's data entirely).
export function analyzeDryingRate(
  readings: MoistureReadingPoint[],
  wateringEvents: WateringEventPoint[],
  periodStart: Date,
  periodEnd: Date,
  options: { maxGapHours?: number; minReadingsPerPeriod?: number } = {},
): DryingRateAnalysis {
  const maxGapHours = options.maxGapHours ?? DEFAULT_MAX_GAP_HOURS;
  const minReadingsPerPeriod = options.minReadingsPerPeriod ?? DEFAULT_MIN_READINGS_PER_PERIOD;

  const validReadings = readings
    .filter(isValidReading)
    .filter((r) => r.recordedAt >= periodStart && r.recordedAt <= periodEnd)
    .sort((a, b) => a.recordedAt.getTime() - b.recordedAt.getTime());

  const wateringBoundaryTimes = wateringEvents
    .map((w) => w.occurredAt.getTime())
    .filter((t) => t > periodStart.getTime() && t < periodEnd.getTime())
    .sort((a, b) => a - b);

  const boundaries = [periodStart.getTime(), ...wateringBoundaryTimes, periodEnd.getTime()];

  const periods: DryingPeriodResult[] = [];
  for (let i = 0; i < boundaries.length - 1; i++) {
    const segStart = new Date(boundaries[i]);
    const segEnd = new Date(boundaries[i + 1]);
    const isLastPeriod = i === boundaries.length - 2;

    // A reading taken exactly at a watering event belongs to the period
    // AFTER it -- it reflects the just-rehydrated state, not the drying
    // trend that preceded the watering. The final period is inclusive of
    // periodEnd on both sides so a reading recorded at the exact end of
    // the analysis window isn't silently dropped.
    const segReadings = validReadings.filter((r) => {
      const t = r.recordedAt.getTime();
      return isLastPeriod
        ? t >= segStart.getTime() && t <= segEnd.getTime()
        : t >= segStart.getTime() && t < segEnd.getTime();
    });

    periods.push(
      analyzeSinglePeriod(segReadings, segStart, segEnd, maxGapHours, minReadingsPerPeriod),
    );
  }

  return {
    analysisPeriodStart: periodStart,
    analysisPeriodEnd: periodEnd,
    unit: 'percent_per_hour',
    periods,
  };
}

// Loads a plant's readings and watering events from the last `periodDays`
// and hands them to analyzeDryingRate(). This is the only part of the
// module that touches the database -- kept separate from the calculation
// above specifically so the calculation itself can be unit-tested without
// one.
export async function getDryingRateForPlant(
  plantId: string,
  periodDays: number = DEFAULT_ANALYSIS_PERIOD_DAYS,
  maxGapHours?: number,
  minReadingsPerPeriod?: number,
): Promise<DryingRateAnalysis> {
  const plant = await prisma.plant.findUnique({ where: { id: plantId } });
  if (!plant) {
    throw new NotFoundError('Plant not found');
  }

  const periodEnd = new Date();
  const periodStart = new Date(periodEnd.getTime() - periodDays * DAY_MS);

  const [readings, wateringEvents] = await Promise.all([
    prisma.sensorReading.findMany({
      where: { plantId, recordedAt: { gte: periodStart, lte: periodEnd } },
      select: { recordedAt: true, moisturePercent: true },
      orderBy: { recordedAt: 'asc' },
    }),
    prisma.careEvent.findMany({
      where: {
        plantId,
        type: 'WATERING',
        deletedAt: null,
        occurredAt: { gte: periodStart, lte: periodEnd },
      },
      select: { occurredAt: true },
      orderBy: { occurredAt: 'asc' },
    }),
  ]);

  return analyzeDryingRate(readings, wateringEvents, periodStart, periodEnd, {
    maxGapHours,
    minReadingsPerPeriod,
  });
}
