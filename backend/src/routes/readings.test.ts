import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app';
import { prisma } from '../db';
import { hashDeviceCredential } from '../lib/device-credential';

const app = createApp();
const SECRET = 'reading-test-secret';

let plantId: string;
let deviceId: string;
let deviceIdentifier: string;

function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    readingId: randomUUID(),
    deviceId,
    recordedAt: '2026-07-16T10:00:00Z',
    rawMoisture: 2048,
    moisturePercent: 45.5,
    firmwareVersion: '1.2.3',
    wifiRssi: -63,
    ...overrides,
  };
}

function authed() {
  return request(app)
    .post('/api/v1/readings')
    .set('X-Device-Id', deviceIdentifier)
    .set('X-Device-Key', SECRET);
}

beforeEach(async () => {
  const plant = await prisma.plant.create({ data: { name: 'Reading Test Plant' } });
  plantId = plant.id;

  deviceIdentifier = `test-reading-device-${randomUUID()}`;
  const device = await prisma.device.create({
    data: {
      name: 'Reading Test Device',
      identifier: deviceIdentifier,
      credentialHash: hashDeviceCredential(SECRET),
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

describe('POST /api/v1/readings', () => {
  it('returns 201 and creates a new reading', async () => {
    const payload = validPayload();
    const res = await authed().send(payload);

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      readingId: payload.readingId,
      status: 'created',
      recordedAt: '2026-07-16T10:00:00.000Z',
      receivedAt: res.body.receivedAt,
    });

    const stored = await prisma.sensorReading.findUnique({ where: { id: payload.readingId } });
    expect(stored).not.toBeNull();
    expect(stored?.rawMoisture).toBe(2048);
    expect(stored?.plantId).toBe(plantId);
  });

  it('updates the device lastSeenAt on ingestion', async () => {
    await authed().send(validPayload());
    const device = await prisma.device.findUniqueOrThrow({ where: { id: deviceId } });
    expect(device.lastSeenAt).not.toBeNull();
  });

  it('does not create a duplicate record on retry with the same readingId', async () => {
    const payload = validPayload();

    const first = await authed().send(payload);
    expect(first.status).toBe(201);
    expect(first.body.status).toBe('created');

    const second = await authed().send(payload);
    expect(second.status).toBe(200);
    expect(second.body.status).toBe('duplicate');
    expect(second.body.readingId).toBe(payload.readingId);

    const count = await prisma.sensorReading.count({ where: { id: payload.readingId } });
    expect(count).toBe(1);
  });

  it('returns 401 when auth headers are missing', async () => {
    const res = await request(app).post('/api/v1/readings').send(validPayload());
    expect(res.status).toBe(401);
  });

  it('returns 401 for an invalid credential', async () => {
    const res = await request(app)
      .post('/api/v1/readings')
      .set('X-Device-Id', deviceIdentifier)
      .set('X-Device-Key', 'wrong-secret')
      .send(validPayload());
    expect(res.status).toBe(401);
  });

  it('returns 403 for a disabled device', async () => {
    await prisma.device.update({ where: { id: deviceId }, data: { enabled: false } });
    const res = await authed().send(validPayload());
    expect(res.status).toBe(403);
  });

  it('returns 400 with field-level details for an out-of-range value', async () => {
    const res = await authed().send(validPayload({ moisturePercent: 150 }));
    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: ['moisturePercent'] })]),
    );
  });

  it('returns 400 for a missing required field', async () => {
    const payload = validPayload();
    delete (payload as Record<string, unknown>).rawMoisture;

    const res = await authed().send(payload);
    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: ['rawMoisture'] })]),
    );
  });

  it('rejects a payload whose deviceId does not match the authenticated device', async () => {
    const res = await authed().send(validPayload({ deviceId: randomUUID() }));
    expect(res.status).toBe(400);
  });

  it('rejects ingestion when the device is not assigned to a plant', async () => {
    const unassignedIdentifier = `test-unassigned-${randomUUID()}`;
    const unassignedDevice = await prisma.device.create({
      data: {
        name: 'Unassigned Device',
        identifier: unassignedIdentifier,
        credentialHash: hashDeviceCredential(SECRET),
        enabled: true,
      },
    });

    const res = await request(app)
      .post('/api/v1/readings')
      .set('X-Device-Id', unassignedIdentifier)
      .set('X-Device-Key', SECRET)
      .send(validPayload({ deviceId: unassignedDevice.id }));

    expect(res.status).toBe(409);

    await prisma.device.deleteMany({ where: { id: unassignedDevice.id } });
  });

  it('rejects a readingId already used by a different device, without altering the original', async () => {
    const payload = validPayload();
    const firstRes = await authed().send(payload);
    expect(firstRes.status).toBe(201);

    const otherIdentifier = `test-other-device-${randomUUID()}`;
    const otherDevice = await prisma.device.create({
      data: {
        name: 'Other Device',
        identifier: otherIdentifier,
        credentialHash: hashDeviceCredential(SECRET),
        enabled: true,
        plantId,
      },
    });

    const res = await request(app)
      .post('/api/v1/readings')
      .set('X-Device-Id', otherIdentifier)
      .set('X-Device-Key', SECRET)
      .send(
        validPayload({
          readingId: payload.readingId,
          deviceId: otherDevice.id,
          rawMoisture: 1,
          moisturePercent: 1,
        }),
      );

    expect(res.status).toBe(409);

    // The original record must be untouched by the rejected overwrite attempt.
    const stored = await prisma.sensorReading.findUniqueOrThrow({
      where: { id: payload.readingId },
    });
    expect(stored.deviceId).toBe(deviceId);
    expect(stored.rawMoisture).toBe(payload.rawMoisture);
    expect(stored.moisturePercent).toBe(payload.moisturePercent);

    await prisma.device.deleteMany({ where: { id: otherDevice.id } });
  });

  it('handles two concurrent submissions of the same readingId as one create and one duplicate', async () => {
    const payload = validPayload();

    const [first, second] = await Promise.all([authed().send(payload), authed().send(payload)]);

    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([200, 201]);

    const bodyStatuses = [first.body.status, second.body.status].sort();
    expect(bodyStatuses).toEqual(['created', 'duplicate']);

    expect(first.body.readingId).toBe(payload.readingId);
    expect(second.body.readingId).toBe(payload.readingId);

    const count = await prisma.sensorReading.count({ where: { id: payload.readingId } });
    expect(count).toBe(1);
  });
});

describe('reading timestamps', () => {
  it('preserves the device-recorded time exactly, in both the response and storage', async () => {
    const recordedAt = '2026-01-01T00:00:00.123Z';
    const payload = validPayload({ recordedAt });

    const res = await authed().send(payload);
    expect(res.status).toBe(201);
    expect(res.body.recordedAt).toBe(recordedAt);

    const stored = await prisma.sensorReading.findUniqueOrThrow({
      where: { id: payload.readingId },
    });
    expect(stored.recordedAt.toISOString()).toBe(recordedAt);
  });

  it('generates receivedAt on the server, ignoring any client-supplied value', async () => {
    const before = Date.now();
    const payload = { ...validPayload(), receivedAt: '1999-01-01T00:00:00Z' };

    const res = await authed().send(payload);
    const after = Date.now();

    expect(res.status).toBe(201);
    const receivedAtMs = new Date(res.body.receivedAt).getTime();
    expect(receivedAtMs).toBeGreaterThanOrEqual(before);
    expect(receivedAtMs).toBeLessThanOrEqual(after);
  });

  it('returns both timestamps as UTC (Z-suffixed) strings', async () => {
    const res = await authed().send(validPayload());
    expect(res.status).toBe(201);
    expect(res.body.recordedAt).toMatch(/Z$/);
    expect(res.body.receivedAt).toMatch(/Z$/);
  });

  it('preserves chronological ordering of recordedAt regardless of submission order', async () => {
    const oldest = validPayload({ recordedAt: '2026-01-01T00:00:00Z' });
    const middle = validPayload({ recordedAt: '2026-01-02T00:00:00Z' });
    const newest = validPayload({ recordedAt: '2026-01-03T00:00:00Z' });

    // Submitted out of chronological order on purpose.
    await authed().send(newest);
    await authed().send(oldest);
    await authed().send(middle);

    const ordered = await prisma.sensorReading.findMany({
      where: { plantId },
      orderBy: { recordedAt: 'asc' },
    });

    expect(ordered.map((r) => r.id)).toEqual([
      oldest.readingId,
      middle.readingId,
      newest.readingId,
    ]);
  });

  it('lets a buffered (delayed) reading be distinguished from a real-time one', async () => {
    const realtime = validPayload({ recordedAt: new Date().toISOString() });
    const buffered = validPayload({
      recordedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
    });

    await authed().send(realtime);
    await authed().send(buffered);

    const [realtimeRow, bufferedRow] = await Promise.all([
      prisma.sensorReading.findUniqueOrThrow({ where: { id: realtime.readingId } }),
      prisma.sensorReading.findUniqueOrThrow({ where: { id: buffered.readingId } }),
    ]);

    const realtimeGapMs = realtimeRow.receivedAt.getTime() - realtimeRow.recordedAt.getTime();
    const bufferedGapMs = bufferedRow.receivedAt.getTime() - bufferedRow.recordedAt.getTime();

    expect(realtimeGapMs).toBeLessThan(60 * 1000); // well under a minute
    expect(bufferedGapMs).toBeGreaterThan(60 * 60 * 1000); // over an hour
    expect(bufferedGapMs).toBeGreaterThan(realtimeGapMs);
  });
});

describe('GET /api/v1/readings/recent', () => {
  // This endpoint is global (not plant-scoped), so the shared dev/test
  // database may hold unrelated rows from seed data or other test files.
  // Using far-future receivedAt values guarantees our own rows sort first,
  // so assertions stay robust regardless of what else exists in the table.
  const FAR_FUTURE = (offsetDays: number) => new Date(Date.UTC(2099, 0, 1 + offsetDays));

  it('includes device and plant identifiers, raw and calibrated values, and both timestamps', async () => {
    const reading = await prisma.sensorReading.create({
      data: {
        id: randomUUID(),
        deviceId,
        plantId,
        recordedAt: new Date('2026-01-01T00:00:00Z'),
        receivedAt: FAR_FUTURE(0),
        rawMoisture: 1800,
        moisturePercent: 38.4,
      },
    });

    const res = await request(app).get('/api/v1/readings/recent');
    expect(res.status).toBe(200);

    const found = res.body.readings.find((r: { id: string }) => r.id === reading.id);
    expect(found).toBeDefined();
    expect(found.deviceId).toBe(deviceId);
    expect(found.plantId).toBe(plantId);
    expect(found.device.identifier).toBe(deviceIdentifier);
    expect(found.plant.name).toBe('Reading Test Plant');
    expect(found.rawMoisture).toBe(1800);
    expect(found.moisturePercent).toBe(38.4);
    expect(found.recordedAt).toBe('2026-01-01T00:00:00.000Z');
    expect(found.receivedAt).toMatch(/Z$/);
  });

  it('sorts newest first by receivedAt, not recordedAt', async () => {
    const olderReceived = await prisma.sensorReading.create({
      data: {
        id: randomUUID(),
        deviceId,
        plantId,
        recordedAt: new Date('2026-06-01T00:00:00Z'), // measured later...
        receivedAt: FAR_FUTURE(0), // ...but received first
        rawMoisture: 1000,
        moisturePercent: 20,
      },
    });
    const newerReceived = await prisma.sensorReading.create({
      data: {
        id: randomUUID(),
        deviceId,
        plantId,
        recordedAt: new Date('2026-01-01T00:00:00Z'), // measured earlier...
        receivedAt: FAR_FUTURE(1), // ...but received last (e.g. a late retry)
        rawMoisture: 1000,
        moisturePercent: 20,
      },
    });

    const res = await request(app).get('/api/v1/readings/recent').query({ limit: 500 });
    const ids = res.body.readings.map((r: { id: string }) => r.id);

    expect(ids.indexOf(newerReceived.id)).toBeLessThan(ids.indexOf(olderReceived.id));
  });

  it('enforces the limit parameter', async () => {
    for (let i = 0; i < 3; i += 1) {
      await prisma.sensorReading.create({
        data: {
          id: randomUUID(),
          deviceId,
          plantId,
          recordedAt: new Date(),
          receivedAt: FAR_FUTURE(i),
          rawMoisture: 1000,
          moisturePercent: 20,
        },
      });
    }

    const res = await request(app).get('/api/v1/readings/recent').query({ limit: 2 });
    expect(res.status).toBe(200);
    expect(res.body.readings).toHaveLength(2);
  });

  it('rejects a limit above the documented maximum', async () => {
    const res = await request(app).get('/api/v1/readings/recent').query({ limit: 501 });
    expect(res.status).toBe(400);
  });

  it('rejects a limit of zero', async () => {
    const res = await request(app).get('/api/v1/readings/recent').query({ limit: 0 });
    expect(res.status).toBe(400);
  });

  it('does not include a rejected submission as a reading', async () => {
    const rejected = await authed().send(validPayload({ moisturePercent: 999 }));
    expect(rejected.status).toBe(400);

    const res = await request(app).get('/api/v1/readings/recent').query({ limit: 500 });
    const matches = res.body.readings.filter((r: { deviceId: string }) => r.deviceId === deviceId);
    expect(matches).toHaveLength(0);
  });
});
