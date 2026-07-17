// Unit tests for analyzeMoistureTrend() -- the pure calculation, with no
// database, no environment variables, no network, just synthetic reading
// arrays (mirrors device-credential.test.ts's "self-contained" style).
// getMoistureTrendForPlant() (the database-touching wrapper) has its own,
// much smaller test block further down, since it needs a real database.

import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { prisma } from '../db';
import { hashDeviceCredential } from '../lib/device-credential';
import {
  analyzeMoistureTrend,
  getMoistureTrendForPlant,
  type MoistureReadingPoint,
} from './moisture-trend-service';

const HOUR_MS = 60 * 60 * 1000;
const baseTime = new Date('2026-01-01T00:00:00Z').getTime();

// hoursAgo: 0 = baseTime, 1 = one hour after baseTime, etc. -- named
// "hoursAgo" to read naturally at call sites ("the reading from 2 hours
// ago") even though it's really "hours after the earliest point" under
// the hood.
function reading(hoursAgo: number, moisturePercent: number): MoistureReadingPoint {
  return { recordedAt: new Date(baseTime + hoursAgo * HOUR_MS), moisturePercent };
}

describe('analyzeMoistureTrend', () => {
  describe('INCREASING', () => {
    it('reports increasing when the change exceeds the tolerance upward', () => {
      const result = analyzeMoistureTrend(
        [reading(0, 30), reading(1, 40), reading(2, 50)],
        3, // tolerance
      );

      expect(result.direction).toBe('INCREASING');
      expect(result.changePercent).toBe(20);
      expect(result.readingCount).toBe(3);
    });

    it('returns the actual earliest/latest readings as evidence', () => {
      const earliest = reading(0, 30);
      const latest = reading(2, 50);
      const result = analyzeMoistureTrend([earliest, reading(1, 40), latest], 3);

      expect(result.earliest).toEqual(earliest);
      expect(result.latest).toEqual(latest);
    });
  });

  describe('DECREASING', () => {
    it('reports decreasing when the change exceeds the tolerance downward', () => {
      const result = analyzeMoistureTrend([reading(0, 60), reading(1, 50), reading(2, 35)], 3);

      expect(result.direction).toBe('DECREASING');
      expect(result.changePercent).toBe(-25);
    });
  });

  describe('STABLE', () => {
    it('reports stable when the change is within tolerance', () => {
      const result = analyzeMoistureTrend([reading(0, 45), reading(1, 46), reading(2, 44)], 3);

      expect(result.direction).toBe('STABLE');
      expect(result.changePercent).toBe(-1);
    });

    it('treats a change exactly equal to the tolerance as stable (inclusive boundary)', () => {
      const result = analyzeMoistureTrend([reading(0, 40), reading(1, 41), reading(2, 43)], 3);
      expect(result.changePercent).toBe(3);
      expect(result.direction).toBe('STABLE');
    });

    it('reports stable for a completely flat reading history', () => {
      const result = analyzeMoistureTrend([reading(0, 50), reading(1, 50), reading(2, 50)], 3);
      expect(result.direction).toBe('STABLE');
      expect(result.changePercent).toBe(0);
    });
  });

  describe('INSUFFICIENT_DATA', () => {
    it('reports insufficient data for zero readings', () => {
      const result = analyzeMoistureTrend([], 3);
      expect(result.direction).toBe('INSUFFICIENT_DATA');
      expect(result.readingCount).toBe(0);
    });

    it('reports insufficient data for one reading', () => {
      const result = analyzeMoistureTrend([reading(0, 50)], 3);
      expect(result.direction).toBe('INSUFFICIENT_DATA');
    });

    it('reports insufficient data below the minimum reading count, even with a real change present', () => {
      // Only 2 readings, default minimum is 3 -- a real 30-point jump
      // exists in the data, but two points alone aren't enough
      // corroborating evidence to call it a confident trend.
      const result = analyzeMoistureTrend([reading(0, 30), reading(1, 60)]);
      expect(result.direction).toBe('INSUFFICIENT_DATA');
    });

    it('never reports earliest/latest/changePercent when insufficient', () => {
      const result = analyzeMoistureTrend([reading(0, 30), reading(1, 60)]);
      expect(result.earliest).toBeUndefined();
      expect(result.latest).toBeUndefined();
      expect(result.changePercent).toBeUndefined();
    });

    it('is satisfied at exactly the minimum reading count', () => {
      const result = analyzeMoistureTrend([reading(0, 30), reading(1, 45), reading(2, 60)]);
      expect(result.direction).not.toBe('INSUFFICIENT_DATA');
    });

    it('respects a custom minimum reading count', () => {
      const readings = [reading(0, 30), reading(1, 40), reading(2, 50)];
      expect(analyzeMoistureTrend(readings, 3, 3).direction).not.toBe('INSUFFICIENT_DATA');
      expect(analyzeMoistureTrend(readings, 3, 5).direction).toBe('INSUFFICIENT_DATA');
    });
  });

  describe('configurable tolerance', () => {
    it('classifies the same data differently depending on the tolerance', () => {
      const readings = [reading(0, 40), reading(1, 42), reading(2, 44)];

      expect(analyzeMoistureTrend(readings, 3).direction).toBe('INCREASING'); // change=4 > 3
      expect(analyzeMoistureTrend(readings, 5).direction).toBe('STABLE'); // change=4 <= 5
    });
  });

  describe('excluding invalid readings', () => {
    it('excludes NaN, Infinity, and out-of-range values from both the count and the calculation', () => {
      const result = analyzeMoistureTrend(
        [
          reading(0, 30),
          { recordedAt: new Date(baseTime + HOUR_MS), moisturePercent: Number.NaN },
          {
            recordedAt: new Date(baseTime + 2 * HOUR_MS),
            moisturePercent: Number.POSITIVE_INFINITY,
          },
          { recordedAt: new Date(baseTime + 3 * HOUR_MS), moisturePercent: -5 },
          { recordedAt: new Date(baseTime + 4 * HOUR_MS), moisturePercent: 105 },
          reading(5, 50),
          reading(6, 70),
        ],
        3,
      );

      // Only the three genuinely valid readings (30, 50, 70) should count.
      expect(result.readingCount).toBe(3);
      expect(result.direction).toBe('INCREASING');
      expect(result.changePercent).toBe(40);
    });

    it('falls back to insufficient data when filtering invalid readings leaves too few', () => {
      const result = analyzeMoistureTrend(
        [
          reading(0, 30),
          { recordedAt: new Date(baseTime + HOUR_MS), moisturePercent: Number.NaN },
          { recordedAt: new Date(baseTime + 2 * HOUR_MS), moisturePercent: -1 },
          reading(3, 50),
        ],
        3,
      );

      // 4 readings in, but only 2 are valid -- below the default minimum of 3.
      expect(result.direction).toBe('INSUFFICIENT_DATA');
      expect(result.readingCount).toBe(2);
    });

    it('accepts the exact boundary values 0 and 100 as valid', () => {
      const result = analyzeMoistureTrend([reading(0, 0), reading(1, 50), reading(2, 100)], 3);
      expect(result.readingCount).toBe(3);
      expect(result.direction).toBe('INCREASING');
    });
  });

  describe('robustness against input order', () => {
    it('identifies earliest/latest by recordedAt, not by array position', () => {
      // Deliberately passed out of chronological order.
      const result = analyzeMoistureTrend([reading(2, 60), reading(0, 30), reading(1, 45)], 3);

      expect(result.earliest?.moisturePercent).toBe(30);
      expect(result.latest?.moisturePercent).toBe(60);
      expect(result.changePercent).toBe(30);
      expect(result.direction).toBe('INCREASING');
    });
  });
});

describe('getMoistureTrendForPlant', () => {
  const createdPlantIds: string[] = [];
  const createdDeviceIds: string[] = [];

  afterEach(async () => {
    if (createdDeviceIds.length > 0) {
      await prisma.sensorReading.deleteMany({ where: { deviceId: { in: createdDeviceIds } } });
      await prisma.device.deleteMany({ where: { id: { in: createdDeviceIds } } });
      createdDeviceIds.length = 0;
    }
    if (createdPlantIds.length > 0) {
      await prisma.plant.deleteMany({ where: { id: { in: createdPlantIds } } });
      createdPlantIds.length = 0;
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function createPlantWithDevice() {
    const plant = await prisma.plant.create({ data: { name: 'Moisture Trend Test Plant' } });
    createdPlantIds.push(plant.id);

    const device = await prisma.device.create({
      data: {
        name: 'Moisture Trend Test Device',
        identifier: `moisture-trend-test-device-${randomUUID()}`,
        credentialHash: hashDeviceCredential('unused'),
        enabled: true,
        plantId: plant.id,
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

  it("computes a trend from a plant's real recent readings", async () => {
    const { plant, device } = await createPlantWithDevice();
    await createReading(device.id, plant.id, 2, 30);
    await createReading(device.id, plant.id, 1, 45);
    await createReading(device.id, plant.id, 0, 60);

    const result = await getMoistureTrendForPlant(plant.id);

    expect(result.direction).toBe('INCREASING');
    expect(result.readingCount).toBe(3);
  });

  it('excludes readings outside the analysis window', async () => {
    const { plant, device } = await createPlantWithDevice();
    // Well outside a 24-hour window.
    await createReading(device.id, plant.id, 100, 10);
    await createReading(device.id, plant.id, 2, 30);
    await createReading(device.id, plant.id, 1, 45);
    await createReading(device.id, plant.id, 0, 60);

    const result = await getMoistureTrendForPlant(plant.id, 24);

    expect(result.readingCount).toBe(3);
    expect(result.earliest?.moisturePercent).toBe(30);
  });

  it('returns insufficient data for a plant with no readings', async () => {
    const { plant } = await createPlantWithDevice();
    const result = await getMoistureTrendForPlant(plant.id);
    expect(result.direction).toBe('INSUFFICIENT_DATA');
    expect(result.readingCount).toBe(0);
  });

  it('respects a custom window and tolerance', async () => {
    const { plant, device } = await createPlantWithDevice();
    await createReading(device.id, plant.id, 5, 40);
    await createReading(device.id, plant.id, 3, 41);
    await createReading(device.id, plant.id, 1, 42);

    const wideTolerance = await getMoistureTrendForPlant(plant.id, 24, 5);
    expect(wideTolerance.direction).toBe('STABLE');

    const narrowTolerance = await getMoistureTrendForPlant(plant.id, 24, 1);
    expect(narrowTolerance.direction).toBe('INCREASING');
  });
});
