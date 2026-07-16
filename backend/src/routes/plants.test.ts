import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app';
import { prisma } from '../db';
import { hashDeviceCredential } from '../lib/device-credential';

const app = createApp();

let plantId: string;
let deviceId: string;

function createReading(overrides: Partial<Record<string, unknown>> = {}) {
  return prisma.sensorReading.create({
    data: {
      id: randomUUID(),
      deviceId,
      plantId,
      recordedAt: new Date(),
      rawMoisture: 2048,
      moisturePercent: 45.5,
      ...overrides,
    },
  });
}

beforeEach(async () => {
  const plant = await prisma.plant.create({ data: { name: 'Latest Reading Test Plant' } });
  plantId = plant.id;

  const device = await prisma.device.create({
    data: {
      name: 'Latest Reading Test Device',
      identifier: `test-latest-device-${randomUUID()}`,
      credentialHash: hashDeviceCredential('unused'),
      enabled: true,
      plantId,
    },
  });
  deviceId = device.id;
});

afterEach(async () => {
  await prisma.sensorReading.deleteMany({ where: { plantId } });
  await prisma.device.deleteMany({ where: { plantId } });
  await prisma.plant.deleteMany({ where: { id: plantId } });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('GET /api/v1/plants/:plantId/readings/latest', () => {
  it('returns 404 for a nonexistent plant', async () => {
    const res = await request(app).get(`/api/v1/plants/${randomUUID()}/readings/latest`);
    expect(res.status).toBe(404);
  });

  it('returns a documented empty result for a plant with no readings', async () => {
    const res = await request(app).get(`/api/v1/plants/${plantId}/readings/latest`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ reading: null });
  });

  it('returns the newest reading by recordedAt, not by insertion order', async () => {
    const oldest = await createReading({ recordedAt: new Date('2026-01-01T00:00:00Z') });
    const newest = await createReading({ recordedAt: new Date('2026-01-03T00:00:00Z') });
    await createReading({ recordedAt: new Date('2026-01-02T00:00:00Z') });

    const res = await request(app).get(`/api/v1/plants/${plantId}/readings/latest`);

    expect(res.status).toBe(200);
    expect(res.body.reading.id).toBe(newest.id);
    expect(res.body.reading.id).not.toBe(oldest.id);
  });

  it('picks the truly newest measurement even when an older buffered reading arrives later', async () => {
    // The real-time reading is received first...
    const realtime = await createReading({
      recordedAt: new Date('2026-01-02T00:00:00Z'),
      receivedAt: new Date('2026-01-02T00:00:05Z'),
    });

    // ...then an older, buffered reading (delayed by a Wi-Fi outage) arrives afterward.
    await createReading({
      recordedAt: new Date('2026-01-01T00:00:00Z'),
      receivedAt: new Date('2026-01-02T01:00:00Z'),
    });

    const res = await request(app).get(`/api/v1/plants/${plantId}/readings/latest`);

    expect(res.status).toBe(200);
    expect(res.body.reading.id).toBe(realtime.id);
  });

  it('includes raw and calibrated values, plus both timestamps', async () => {
    const reading = await createReading({
      rawMoisture: 3000,
      moisturePercent: 73.2,
      recordedAt: new Date('2026-01-01T12:00:00.000Z'),
    });

    const res = await request(app).get(`/api/v1/plants/${plantId}/readings/latest`);

    expect(res.status).toBe(200);
    expect(res.body.reading).toMatchObject({
      id: reading.id,
      rawMoisture: 3000,
      moisturePercent: 73.2,
      recordedAt: '2026-01-01T12:00:00.000Z',
    });
    expect(res.body.reading.receivedAt).toMatch(/Z$/);
  });
});

describe('GET /api/v1/plants/:plantId/readings', () => {
  it('returns 404 for a nonexistent plant', async () => {
    const res = await request(app).get(`/api/v1/plants/${randomUUID()}/readings`);
    expect(res.status).toBe(404);
  });

  it('returns an empty list for a plant with no readings', async () => {
    const res = await request(app).get(`/api/v1/plants/${plantId}/readings`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ readings: [] });
  });

  it('defaults to chronological (ascending) order', async () => {
    const first = await createReading({ recordedAt: new Date('2026-01-01T00:00:00Z') });
    const second = await createReading({ recordedAt: new Date('2026-01-02T00:00:00Z') });
    const third = await createReading({ recordedAt: new Date('2026-01-03T00:00:00Z') });

    const res = await request(app).get(`/api/v1/plants/${plantId}/readings`);

    expect(res.status).toBe(200);
    expect(res.body.readings.map((r: { id: string }) => r.id)).toEqual([
      first.id,
      second.id,
      third.id,
    ]);
  });

  it('supports sort=desc', async () => {
    const first = await createReading({ recordedAt: new Date('2026-01-01T00:00:00Z') });
    const second = await createReading({ recordedAt: new Date('2026-01-02T00:00:00Z') });

    const res = await request(app).get(`/api/v1/plants/${plantId}/readings?sort=desc`);

    expect(res.status).toBe(200);
    expect(res.body.readings.map((r: { id: string }) => r.id)).toEqual([second.id, first.id]);
  });

  it('filters by start and end', async () => {
    const tooEarly = await createReading({ recordedAt: new Date('2026-01-01T00:00:00Z') });
    const inRange = await createReading({ recordedAt: new Date('2026-01-02T00:00:00Z') });
    const tooLate = await createReading({ recordedAt: new Date('2026-01-03T00:00:00Z') });

    const res = await request(app)
      .get(`/api/v1/plants/${plantId}/readings`)
      .query({ start: '2026-01-01T12:00:00Z', end: '2026-01-02T12:00:00Z' });

    expect(res.status).toBe(200);
    const ids = res.body.readings.map((r: { id: string }) => r.id);
    expect(ids).toEqual([inRange.id]);
    expect(ids).not.toContain(tooEarly.id);
    expect(ids).not.toContain(tooLate.id);
  });

  it('supports an open-ended range with only start or only end', async () => {
    const early = await createReading({ recordedAt: new Date('2026-01-01T00:00:00Z') });
    const late = await createReading({ recordedAt: new Date('2026-01-03T00:00:00Z') });

    const fromStart = await request(app)
      .get(`/api/v1/plants/${plantId}/readings`)
      .query({ start: '2026-01-02T00:00:00Z' });
    expect(fromStart.body.readings.map((r: { id: string }) => r.id)).toEqual([late.id]);

    const untilEnd = await request(app)
      .get(`/api/v1/plants/${plantId}/readings`)
      .query({ end: '2026-01-02T00:00:00Z' });
    expect(untilEnd.body.readings.map((r: { id: string }) => r.id)).toEqual([early.id]);
  });

  it('rejects a start after end', async () => {
    const res = await request(app)
      .get(`/api/v1/plants/${plantId}/readings`)
      .query({ start: '2026-01-02T00:00:00Z', end: '2026-01-01T00:00:00Z' });

    expect(res.status).toBe(400);
  });

  it('rejects a malformed start timestamp', async () => {
    const res = await request(app)
      .get(`/api/v1/plants/${plantId}/readings`)
      .query({ start: 'not-a-date' });

    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: ['start'] })]),
    );
  });

  it('enforces the limit parameter', async () => {
    for (let i = 0; i < 5; i += 1) {
      await createReading({ recordedAt: new Date(Date.UTC(2026, 0, i + 1)) });
    }

    const res = await request(app).get(`/api/v1/plants/${plantId}/readings`).query({ limit: 2 });

    expect(res.status).toBe(200);
    expect(res.body.readings).toHaveLength(2);
  });

  it('rejects a limit above the documented maximum', async () => {
    const res = await request(app).get(`/api/v1/plants/${plantId}/readings`).query({ limit: 1001 });

    expect(res.status).toBe(400);
  });

  it('rejects a limit of zero or negative', async () => {
    const res = await request(app).get(`/api/v1/plants/${plantId}/readings`).query({ limit: 0 });
    expect(res.status).toBe(400);
  });

  it('includes raw and calibrated values for every reading', async () => {
    await createReading({ rawMoisture: 1500, moisturePercent: 30.1 });
    await createReading({ rawMoisture: 2500, moisturePercent: 60.9 });

    const res = await request(app).get(`/api/v1/plants/${plantId}/readings`);

    expect(res.status).toBe(200);
    expect(res.body.readings).toHaveLength(2);
    for (const reading of res.body.readings) {
      expect(typeof reading.rawMoisture).toBe('number');
      expect(typeof reading.moisturePercent).toBe('number');
      expect(reading.recordedAt).toMatch(/Z$/);
      expect(reading.receivedAt).toMatch(/Z$/);
    }
  });
});
