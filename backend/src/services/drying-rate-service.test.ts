// Unit tests for analyzeDryingRate() -- the pure calculation, with no
// database, no environment variables, no network, just synthetic reading
// and watering-event arrays (mirrors moisture-trend-service.test.ts's
// self-contained style). getDryingRateForPlant() (the database-touching
// wrapper) has its own, much smaller test block further down, since it
// needs a real database.

import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { prisma } from '../db';
import { hashDeviceCredential } from '../lib/device-credential';
import { NotFoundError } from '../http/errors';
import { createTestUserAndToken } from '../test-helpers/auth';
import {
  analyzeDryingRate,
  getDryingRateForPlant,
  type MoistureReadingPoint,
  type WateringEventPoint,
} from './drying-rate-service';

const HOUR_MS = 60 * 60 * 1000;
const baseTime = new Date('2026-01-01T00:00:00Z').getTime();

function reading(hoursFromBase: number, moisturePercent: number): MoistureReadingPoint {
  return { recordedAt: new Date(baseTime + hoursFromBase * HOUR_MS), moisturePercent };
}

function watering(hoursFromBase: number): WateringEventPoint {
  return { occurredAt: new Date(baseTime + hoursFromBase * HOUR_MS) };
}

const periodStart = new Date(baseTime);
const periodEnd = new Date(baseTime + 48 * HOUR_MS);

describe('analyzeDryingRate', () => {
  describe('VALID -- a continuous decreasing period', () => {
    it('calculates a positive rate magnitude for a steady decline', () => {
      const result = analyzeDryingRate(
        [reading(0, 60), reading(2, 55), reading(4, 50)],
        [],
        periodStart,
        periodEnd,
      );

      expect(result.periods).toHaveLength(1);
      const [period] = result.periods;
      expect(period.state).toBe('VALID');
      // 10 points over 4 hours = 2.5 %/hour.
      expect(period.ratePercentPerHour).toBeCloseTo(2.5, 5);
      expect(period.hasGap).toBe(false);
      expect(period.readingCount).toBe(3);
    });

    it('always returns a non-negative rate magnitude, not a signed delta', () => {
      const result = analyzeDryingRate(
        [reading(0, 80), reading(5, 70), reading(10, 60)],
        [],
        periodStart,
        periodEnd,
      );
      expect(result.periods[0].ratePercentPerHour).toBeGreaterThan(0);
    });
  });

  describe('watering events divide analysis periods', () => {
    it('splits into two periods around a single watering event', () => {
      const result = analyzeDryingRate(
        [
          reading(0, 60),
          reading(2, 55),
          reading(4, 50), // drying period 1
          reading(6, 90), // rehydrated right after watering at hour 5
          reading(8, 85),
          reading(10, 80), // drying period 2
        ],
        [watering(5)],
        periodStart,
        periodEnd,
      );

      expect(result.periods).toHaveLength(2);
      expect(result.periods[0].readingCount).toBe(3);
      expect(result.periods[1].readingCount).toBe(3);
      expect(result.periods[0].state).toBe('VALID');
      expect(result.periods[1].state).toBe('VALID');
    });

    it('assigns a reading recorded exactly at the watering timestamp to the following period', () => {
      const result = analyzeDryingRate(
        [reading(0, 60), reading(4, 50), reading(5, 90), reading(8, 80), reading(10, 70)],
        [watering(5)],
        periodStart,
        periodEnd,
      );

      // First period: hours 0 and 4 (2 readings). Second: 5, 8, 10 (3 readings).
      expect(result.periods[0].readingCount).toBe(2);
      expect(result.periods[1].readingCount).toBe(3);
    });

    it('splits into three periods around two watering events', () => {
      const result = analyzeDryingRate(
        [
          reading(0, 60),
          reading(2, 50),
          reading(4, 40),
          reading(6, 90),
          reading(8, 80),
          reading(10, 70),
          reading(16, 95),
          reading(18, 85),
          reading(20, 75),
        ],
        [watering(5), watering(15)],
        periodStart,
        periodEnd,
      );

      expect(result.periods).toHaveLength(3);
      expect(result.periods.map((p) => p.readingCount)).toEqual([3, 3, 3]);
    });

    it('produces exactly one period spanning the whole window when there are no watering events', () => {
      const result = analyzeDryingRate(
        [reading(0, 60), reading(10, 50), reading(20, 40)],
        [],
        periodStart,
        periodEnd,
      );

      expect(result.periods).toHaveLength(1);
      expect(result.periods[0].periodStart).toEqual(periodStart);
      expect(result.periods[0].periodEnd).toEqual(periodEnd);
    });

    it('ignores watering events outside the analysis window', () => {
      const result = analyzeDryingRate(
        [reading(0, 60), reading(10, 50), reading(20, 40)],
        [{ occurredAt: new Date(baseTime - 100 * HOUR_MS) }],
        periodStart,
        periodEnd,
      );
      expect(result.periods).toHaveLength(1);
    });
  });

  describe('excessive data gaps lower confidence', () => {
    it('marks a period LOW_CONFIDENCE when a gap exceeds maxGapHours, but still reports a rate', () => {
      const result = analyzeDryingRate(
        [reading(0, 60), reading(1, 58), reading(20, 40)], // 19-hour gap between the 2nd and 3rd
        [],
        periodStart,
        periodEnd,
        { maxGapHours: 6 },
      );

      const [period] = result.periods;
      expect(period.state).toBe('LOW_CONFIDENCE');
      expect(period.hasGap).toBe(true);
      expect(period.ratePercentPerHour).toBeDefined();
    });

    it('does not flag a gap within the configured tolerance', () => {
      const result = analyzeDryingRate(
        [reading(0, 60), reading(4, 55), reading(8, 50)],
        [],
        periodStart,
        periodEnd,
        { maxGapHours: 6 },
      );
      expect(result.periods[0].hasGap).toBe(false);
      expect(result.periods[0].state).toBe('VALID');
    });

    it('respects a custom maxGapHours', () => {
      const readings = [reading(0, 60), reading(3, 55), reading(6, 50)];
      expect(
        analyzeDryingRate(readings, [], periodStart, periodEnd, { maxGapHours: 6 }).periods[0]
          .state,
      ).toBe('VALID');
      expect(
        analyzeDryingRate(readings, [], periodStart, periodEnd, { maxGapHours: 2 }).periods[0]
          .state,
      ).toBe('LOW_CONFIDENCE');
    });
  });

  describe('INSUFFICIENT_DATA', () => {
    it('reports insufficient data for a period with zero readings', () => {
      const result = analyzeDryingRate([], [], periodStart, periodEnd);
      expect(result.periods[0].state).toBe('INSUFFICIENT_DATA');
      expect(result.periods[0].ratePercentPerHour).toBeUndefined();
    });

    it('reports insufficient data below the default minimum reading count', () => {
      const result = analyzeDryingRate(
        [reading(0, 60), reading(10, 40)],
        [],
        periodStart,
        periodEnd,
      );
      expect(result.periods[0].state).toBe('INSUFFICIENT_DATA');
    });

    it('respects a custom minimum reading count', () => {
      const readings = [reading(0, 60), reading(10, 50), reading(20, 40)];
      expect(
        analyzeDryingRate(readings, [], periodStart, periodEnd, { minReadingsPerPeriod: 3 })
          .periods[0].state,
      ).not.toBe('INSUFFICIENT_DATA');
      expect(
        analyzeDryingRate(readings, [], periodStart, periodEnd, { minReadingsPerPeriod: 5 })
          .periods[0].state,
      ).toBe('INSUFFICIENT_DATA');
    });

    it('treats two readings at an identical timestamp as insufficient rather than dividing by zero', () => {
      const sameInstant = new Date(baseTime + 5 * HOUR_MS);
      const result = analyzeDryingRate(
        [
          { recordedAt: sameInstant, moisturePercent: 60 },
          { recordedAt: sameInstant, moisturePercent: 55 },
          { recordedAt: sameInstant, moisturePercent: 50 },
        ],
        [],
        periodStart,
        periodEnd,
      );
      expect(result.periods[0].state).toBe('INSUFFICIENT_DATA');
      expect(result.periods[0].ratePercentPerHour).toBeUndefined();
    });
  });

  describe('NOT_DRYING -- increasing moisture is not mislabeled as drying', () => {
    it('reports NOT_DRYING for an increasing period, with no rate', () => {
      const result = analyzeDryingRate(
        [reading(0, 30), reading(10, 45), reading(20, 60)],
        [],
        periodStart,
        periodEnd,
      );

      expect(result.periods[0].state).toBe('NOT_DRYING');
      expect(result.periods[0].ratePercentPerHour).toBeUndefined();
    });

    it('reports NOT_DRYING for a perfectly flat period', () => {
      const result = analyzeDryingRate(
        [reading(0, 50), reading(10, 50), reading(20, 50)],
        [],
        periodStart,
        periodEnd,
      );
      expect(result.periods[0].state).toBe('NOT_DRYING');
    });

    it('correctly labels a genuinely mixed history: drying before watering, rising after', () => {
      const result = analyzeDryingRate(
        [
          reading(0, 60),
          reading(2, 50),
          reading(4, 40),
          reading(6, 45),
          reading(8, 55),
          reading(10, 65),
        ],
        [watering(5)],
        periodStart,
        periodEnd,
      );

      expect(result.periods[0].state).toBe('VALID'); // 60 -> 40, drying
      expect(result.periods[1].state).toBe('NOT_DRYING'); // 45 -> 65, rising
    });
  });

  describe('excluding invalid readings', () => {
    it('excludes NaN, Infinity, and out-of-range values before splitting or calculating', () => {
      const result = analyzeDryingRate(
        [
          reading(0, 60),
          { recordedAt: new Date(baseTime + 1 * HOUR_MS), moisturePercent: Number.NaN },
          { recordedAt: new Date(baseTime + 2 * HOUR_MS), moisturePercent: -10 },
          reading(3, 50),
          reading(4, 40),
        ],
        [],
        periodStart,
        periodEnd,
      );

      expect(result.periods[0].readingCount).toBe(3);
      expect(result.periods[0].state).toBe('VALID');
    });

    it('excludes readings outside the analysis period', () => {
      const result = analyzeDryingRate(
        [
          { recordedAt: new Date(baseTime - 5 * HOUR_MS), moisturePercent: 90 }, // before periodStart
          reading(0, 60),
          reading(10, 50),
          reading(20, 40),
          { recordedAt: new Date(baseTime + 100 * HOUR_MS), moisturePercent: 10 }, // after periodEnd
        ],
        [],
        periodStart,
        periodEnd,
      );
      expect(result.periods[0].readingCount).toBe(3);
    });
  });

  describe('units and analysis period are returned', () => {
    it('always echoes back the requested analysis period and unit', () => {
      const result = analyzeDryingRate([], [], periodStart, periodEnd);
      expect(result.analysisPeriodStart).toEqual(periodStart);
      expect(result.analysisPeriodEnd).toEqual(periodEnd);
      expect(result.unit).toBe('percent_per_hour');
    });
  });

  describe('robustness against input order', () => {
    it('sorts readings by recordedAt regardless of array order', () => {
      const result = analyzeDryingRate(
        [reading(4, 40), reading(0, 60), reading(2, 50)],
        [],
        periodStart,
        periodEnd,
      );
      expect(result.periods[0].state).toBe('VALID');
      expect(result.periods[0].ratePercentPerHour).toBeCloseTo(5, 5);
    });
  });
});

describe('getDryingRateForPlant', () => {
  const createdPlantIds: string[] = [];
  const createdDeviceIds: string[] = [];
  let userId: string;

  beforeEach(async () => {
    ({ userId } = await createTestUserAndToken());
  });

  afterEach(async () => {
    if (createdDeviceIds.length > 0) {
      await prisma.sensorReading.deleteMany({ where: { deviceId: { in: createdDeviceIds } } });
      await prisma.device.deleteMany({ where: { id: { in: createdDeviceIds } } });
      createdDeviceIds.length = 0;
    }
    if (createdPlantIds.length > 0) {
      await prisma.careEvent.deleteMany({ where: { plantId: { in: createdPlantIds } } });
      await prisma.plant.deleteMany({ where: { id: { in: createdPlantIds } } });
      createdPlantIds.length = 0;
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function createPlantWithDevice() {
    const plant = await prisma.plant.create({
      data: { name: 'Drying Rate Test Plant', userId },
    });
    createdPlantIds.push(plant.id);

    const device = await prisma.device.create({
      data: {
        name: 'Drying Rate Test Device',
        identifier: `drying-rate-test-device-${randomUUID()}`,
        credentialHash: hashDeviceCredential('unused'),
        enabled: true,
        plantId: plant.id,
        userId,
      },
    });
    createdDeviceIds.push(device.id);

    return { plant, device };
  }

  async function createReading(
    deviceId: string,
    plantId: string,
    hoursAgo: number,
    moisturePercent: number,
  ) {
    return prisma.sensorReading.create({
      data: {
        id: randomUUID(),
        deviceId,
        plantId,
        recordedAt: new Date(Date.now() - hoursAgo * HOUR_MS),
        rawMoisture: 2048,
        moisturePercent,
      },
    });
  }

  async function createWatering(plantId: string, hoursAgo: number) {
    return prisma.careEvent.create({
      data: {
        type: 'WATERING',
        plantId,
        occurredAt: new Date(Date.now() - hoursAgo * HOUR_MS),
      },
    });
  }

  it("computes a drying rate from a plant's real recent readings", async () => {
    const { plant, device } = await createPlantWithDevice();
    await createReading(device.id, plant.id, 4, 60);
    await createReading(device.id, plant.id, 2, 50);
    await createReading(device.id, plant.id, 0, 40);

    const result = await getDryingRateForPlant(plant.id, userId);

    expect(result.periods).toHaveLength(1);
    expect(result.periods[0].state).toBe('VALID');
  });

  it('splits real readings around a real watering event', async () => {
    const { plant, device } = await createPlantWithDevice();
    await createReading(device.id, plant.id, 20, 60);
    await createReading(device.id, plant.id, 16, 50);
    await createReading(device.id, plant.id, 12, 40);
    await createWatering(plant.id, 10);
    await createReading(device.id, plant.id, 8, 90);
    await createReading(device.id, plant.id, 4, 80);
    await createReading(device.id, plant.id, 0, 70);

    const result = await getDryingRateForPlant(plant.id, userId);

    expect(result.periods).toHaveLength(2);
    expect(result.periods[0].state).toBe('VALID');
    expect(result.periods[1].state).toBe('VALID');
  });

  it('ignores soft-deleted watering events', async () => {
    const { plant, device } = await createPlantWithDevice();
    await createReading(device.id, plant.id, 20, 60);
    await createReading(device.id, plant.id, 10, 50);
    await createReading(device.id, plant.id, 0, 40);
    const wateringEvent = await createWatering(plant.id, 10);
    await prisma.careEvent.update({
      where: { id: wateringEvent.id },
      data: { deletedAt: new Date() },
    });

    const result = await getDryingRateForPlant(plant.id, userId);

    expect(result.periods).toHaveLength(1);
  });

  it('returns insufficient data for a plant with no readings', async () => {
    const { plant } = await createPlantWithDevice();
    const result = await getDryingRateForPlant(plant.id, userId);
    expect(result.periods[0].state).toBe('INSUFFICIENT_DATA');
  });

  it('throws NotFoundError for a nonexistent plant', async () => {
    await expect(getDryingRateForPlant(randomUUID(), userId)).rejects.toThrow(NotFoundError);
  });
});
