// Unit tests for ingestReading() itself, calling the service function
// directly rather than through HTTP (contrast with routes/readings.test.ts,
// which exercises the same behavior end-to-end via supertest -- both exist
// on purpose: this file isolates the service's own logic from routing,
// auth, and request parsing).
//
// Still needs a real database: ingestReading() isn't pure, it reads and
// writes SensorReading/Device rows directly via Prisma, consistent with
// this project's "no mocking the database" testing convention.

import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../db';
import { hashDeviceCredential } from '../lib/device-credential';
import { logger } from '../lib/logger';
import { ConflictError, ValidationError } from '../http/errors';
import { createTestUserAndToken } from '../test-helpers/auth';
import { ingestReading } from './reading-service';
import type { PublicDevice } from './device-service';
import type { SensorReadingInput } from '../validation/reading';

let plantId: string;
let device: PublicDevice;
let userId: string;

function validInput(overrides: Partial<SensorReadingInput> = {}): SensorReadingInput {
  return {
    readingId: randomUUID(),
    deviceId: device.id,
    recordedAt: new Date().toISOString(),
    rawMoisture: 2048,
    moisturePercent: 45.5,
    ...overrides,
  };
}

beforeEach(async () => {
  ({ userId } = await createTestUserAndToken());

  const plant = await prisma.plant.create({
    data: { name: 'Reading Service Test Plant', userId },
  });
  plantId = plant.id;

  const created = await prisma.device.create({
    data: {
      name: 'Reading Service Test Device',
      identifier: `reading-service-test-device-${randomUUID()}`,
      credentialHash: hashDeviceCredential('unused'),
      enabled: true,
      plantId,
      userId,
    },
  });

  const { credentialHash: _credentialHash, ...publicDevice } = created;
  device = publicDevice;
});

afterEach(async () => {
  await prisma.sensorReading.deleteMany({ where: { plantId } });
  await prisma.device.deleteMany({ where: { plantId } });
  await prisma.plant.deleteMany({ where: { id: plantId } });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('ingestReading', () => {
  it('stores a valid reading exactly once and returns a typed "created" result', async () => {
    const input = validInput();
    const result = await ingestReading(input, device);

    expect(result).toEqual({
      readingId: input.readingId,
      status: 'created',
      recordedAt: new Date(input.recordedAt).toISOString(),
      receivedAt: expect.any(String),
    });

    const count = await prisma.sensorReading.count({ where: { id: input.readingId } });
    expect(count).toBe(1);
  });

  it("assigns the reading to the device's currently assigned plant", async () => {
    const input = validInput();
    await ingestReading(input, device);

    const stored = await prisma.sensorReading.findUniqueOrThrow({
      where: { id: input.readingId },
    });
    expect(stored.plantId).toBe(plantId);
    expect(stored.deviceId).toBe(device.id);
  });

  it('stores raw, calibrated, and optional metadata fields', async () => {
    const input = validInput({ firmwareVersion: '1.2.3', wifiRssi: -60 });
    await ingestReading(input, device);

    const stored = await prisma.sensorReading.findUniqueOrThrow({
      where: { id: input.readingId },
    });
    expect(stored.rawMoisture).toBe(input.rawMoisture);
    expect(stored.moisturePercent).toBe(input.moisturePercent);
    expect(stored.firmwareVersion).toBe('1.2.3');
    expect(stored.wifiRssi).toBe(-60);
  });

  it('rejects a payload whose deviceId does not match the authenticated device', async () => {
    const input = validInput({ deviceId: randomUUID() });

    await expect(ingestReading(input, device)).rejects.toBeInstanceOf(ValidationError);

    const count = await prisma.sensorReading.count({ where: { id: input.readingId } });
    expect(count).toBe(0);
  });

  it('rejects a device with no active plant assignment', async () => {
    const unassignedRow = await prisma.device.create({
      data: {
        name: 'Unassigned Device',
        identifier: `reading-service-test-device-${randomUUID()}`,
        credentialHash: hashDeviceCredential('unused'),
        enabled: true,
        userId,
      },
    });
    const { credentialHash: _hash, ...unassignedDevice } = unassignedRow;

    const input = validInput({ deviceId: unassignedDevice.id });

    await expect(ingestReading(input, unassignedDevice)).rejects.toBeInstanceOf(ConflictError);

    const count = await prisma.sensorReading.count({ where: { id: input.readingId } });
    expect(count).toBe(0);

    await prisma.device.deleteMany({ where: { id: unassignedDevice.id } });
  });

  it('updates the device last-seen time on a successful ingestion', async () => {
    const before = await prisma.device.findUniqueOrThrow({ where: { id: device.id } });
    expect(before.lastSeenAt).toBeNull();

    await ingestReading(validInput(), device);

    const after = await prisma.device.findUniqueOrThrow({ where: { id: device.id } });
    expect(after.lastSeenAt).not.toBeNull();
  });

  it('treats a retried identical readingId from the same device as an idempotent duplicate, without a second row', async () => {
    const input = validInput();
    const first = await ingestReading(input, device);
    expect(first.status).toBe('created');

    const second = await ingestReading(input, device);
    expect(second.status).toBe('duplicate');
    expect(second.readingId).toBe(input.readingId);

    const count = await prisma.sensorReading.count({ where: { id: input.readingId } });
    expect(count).toBe(1);
  });

  it('updates last-seen time even on a duplicate retry', async () => {
    const input = validInput();
    await ingestReading(input, device);
    await prisma.device.update({ where: { id: device.id }, data: { lastSeenAt: null } });

    await ingestReading(input, device);

    const after = await prisma.device.findUniqueOrThrow({ where: { id: device.id } });
    expect(after.lastSeenAt).not.toBeNull();
  });

  it('rejects a readingId already used by a different device, leaving the original untouched', async () => {
    const input = validInput();
    await ingestReading(input, device);

    const otherPlant = await prisma.plant.create({ data: { name: 'Other Plant', userId } });
    const otherRow = await prisma.device.create({
      data: {
        name: 'Other Device',
        identifier: `reading-service-test-device-${randomUUID()}`,
        credentialHash: hashDeviceCredential('unused'),
        enabled: true,
        plantId: otherPlant.id,
        userId,
      },
    });
    const { credentialHash: _hash, ...otherDevice } = otherRow;

    await expect(
      ingestReading(
        validInput({ readingId: input.readingId, deviceId: otherDevice.id }),
        otherDevice,
      ),
    ).rejects.toBeInstanceOf(ConflictError);

    const stored = await prisma.sensorReading.findUniqueOrThrow({
      where: { id: input.readingId },
    });
    expect(stored.deviceId).toBe(device.id);

    await prisma.device.deleteMany({ where: { id: otherDevice.id } });
    await prisma.plant.deleteMany({ where: { id: otherPlant.id } });
  });

  it('handles two concurrent identical submissions as one create and one duplicate', async () => {
    const input = validInput();

    const [first, second] = await Promise.all([
      ingestReading(input, device),
      ingestReading(input, device),
    ]);

    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual(['created', 'duplicate']);

    const count = await prisma.sensorReading.count({ where: { id: input.readingId } });
    expect(count).toBe(1);
  });

  it('logs and rethrows on a genuine database failure, for the HTTP layer to turn into a structured 500', async () => {
    const errorSpy = vi.spyOn(logger, 'error');

    // Bypasses zod validation on purpose -- reaches Prisma with a value
    // only the DB-level CHECK constraint rejects (not a
    // duplicate/unique-constraint case, which is handled separately -- see
    // the tests above).
    const input = { ...validInput(), moisturePercent: 999 } as SensorReadingInput;

    await expect(ingestReading(input, device)).rejects.toThrow();

    expect(errorSpy).toHaveBeenCalledWith(
      expect.objectContaining({ readingId: input.readingId, deviceId: device.id }),
      'Reading ingestion failed due to a database error',
    );

    const count = await prisma.sensorReading.count({ where: { id: input.readingId } });
    expect(count).toBe(0);

    errorSpy.mockRestore();
  });
});
