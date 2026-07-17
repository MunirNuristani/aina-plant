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

describe('POST /api/v1/plants', () => {
  const createdPlantIds: string[] = [];

  afterEach(async () => {
    if (createdPlantIds.length > 0) {
      await prisma.plant.deleteMany({ where: { id: { in: createdPlantIds } } });
      createdPlantIds.length = 0;
    }
  });

  function post(body: unknown) {
    return request(app).post('/api/v1/plants').send(body);
  }

  it('creates a valid plant and returns 201 with the full created record', async () => {
    const payload = {
      name: 'Fiddle Leaf Fig',
      commonName: 'Fiddle Leaf Fig',
      scientificName: 'Ficus lyrata',
      location: 'Living room',
      notes: 'Likes bright indirect light',
      potSize: '10in',
      soilType: 'Well-draining potting mix',
    };

    const res = await post(payload);
    createdPlantIds.push(res.body.plant?.id);

    expect(res.status).toBe(201);
    expect(res.body.plant).toMatchObject(payload);
    expect(res.body.plant.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    expect(res.body.plant.createdAt).toMatch(/Z$/);
    expect(res.body.plant.updatedAt).toMatch(/Z$/);
  });

  it('creates a plant with only the required name', async () => {
    const res = await post({ name: 'Minimal Plant' });
    createdPlantIds.push(res.body.plant?.id);

    expect(res.status).toBe(201);
    expect(res.body.plant.name).toBe('Minimal Plant');
    expect(res.body.plant.commonName).toBeNull();
  });

  it('rejects a missing name with a standard-format field error', async () => {
    const res = await post({ location: 'Kitchen' });

    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'name' })]),
    );
  });

  it('rejects a whitespace-only name', async () => {
    const res = await post({ name: '   ' });

    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'name' })]),
    );
  });

  it('rejects a name over 100 characters', async () => {
    const res = await post({ name: 'x'.repeat(101) });
    expect(res.status).toBe(400);
  });

  it('trims leading/trailing whitespace from the name', async () => {
    const res = await post({ name: '  Snake Plant  ' });
    createdPlantIds.push(res.body.plant?.id);

    expect(res.status).toBe(201);
    expect(res.body.plant.name).toBe('Snake Plant');
  });

  it('accepts empty strings for optional fields', async () => {
    const res = await post({ name: 'Empty Fields Plant', commonName: '', notes: '' });
    createdPlantIds.push(res.body.plant?.id);

    expect(res.status).toBe(201);
    expect(res.body.plant.commonName).toBe('');
    expect(res.body.plant.notes).toBe('');
  });

  it('does not create a plant when validation fails', async () => {
    const before = await prisma.plant.count();
    await post({ name: '' });
    const after = await prisma.plant.count();

    expect(after).toBe(before);
  });

  it('persists the created plant so it can be retrieved afterward', async () => {
    const res = await post({ name: 'Retrievable Plant', location: 'Office' });
    createdPlantIds.push(res.body.plant?.id);
    expect(res.status).toBe(201);

    const stored = await prisma.plant.findUnique({ where: { id: res.body.plant.id } });
    expect(stored).not.toBeNull();
    expect(stored?.name).toBe('Retrievable Plant');
    expect(stored?.location).toBe('Office');
  });
});

describe('GET /api/v1/plants and GET /api/v1/plants/:plantId', () => {
  const createdPlantIds: string[] = [];
  const createdDeviceIds: string[] = [];

  afterEach(async () => {
    if (createdDeviceIds.length > 0) {
      await prisma.device.deleteMany({ where: { id: { in: createdDeviceIds } } });
      createdDeviceIds.length = 0;
    }
    if (createdPlantIds.length > 0) {
      await prisma.plant.deleteMany({ where: { id: { in: createdPlantIds } } });
      createdPlantIds.length = 0;
    }
  });

  async function createTestPlant(overrides: Partial<Record<string, unknown>> = {}) {
    const plant = await prisma.plant.create({
      data: { name: 'List/Detail Test Plant', ...overrides },
    });
    createdPlantIds.push(plant.id);
    return plant;
  }

  async function createTestDevice(
    plantIdForDevice: string,
    overrides: Partial<Record<string, unknown>> = {},
  ) {
    const device = await prisma.device.create({
      data: {
        name: 'List/Detail Test Device',
        identifier: `list-detail-test-device-${randomUUID()}`,
        credentialHash: hashDeviceCredential('unused'),
        enabled: true,
        plantId: plantIdForDevice,
        ...overrides,
      },
    });
    createdDeviceIds.push(device.id);
    return device;
  }

  describe('GET /api/v1/plants', () => {
    it('returns a well-formed array response', async () => {
      const res = await request(app).get('/api/v1/plants');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.plants)).toBe(true);
    });

    it('lists a plant just created', async () => {
      const plant = await createTestPlant({ name: 'Listed Plant' });

      const res = await request(app).get('/api/v1/plants');

      expect(res.status).toBe(200);
      const found = res.body.plants.find((p: { id: string }) => p.id === plant.id);
      expect(found).toBeDefined();
      expect(found.name).toBe('Listed Plant');
    });

    it('includes an empty devices array for a plant with no device assigned', async () => {
      const plant = await createTestPlant();

      const res = await request(app).get('/api/v1/plants');

      const found = res.body.plants.find((p: { id: string }) => p.id === plant.id);
      expect(found.devices).toEqual([]);
    });

    it('includes an enabled device assigned to a plant', async () => {
      const plant = await createTestPlant();
      const device = await createTestDevice(plant.id);

      const res = await request(app).get('/api/v1/plants');

      const found = res.body.plants.find((p: { id: string }) => p.id === plant.id);
      expect(found.devices).toHaveLength(1);
      expect(found.devices[0]).toMatchObject({
        id: device.id,
        identifier: device.identifier,
        enabled: true,
      });
      expect(found.devices[0].credentialHash).toBeUndefined();
    });

    it('excludes a disabled device from the devices array', async () => {
      const plant = await createTestPlant();
      await createTestDevice(plant.id, { enabled: false });

      const res = await request(app).get('/api/v1/plants');

      const found = res.body.plants.find((p: { id: string }) => p.id === plant.id);
      expect(found.devices).toEqual([]);
    });
  });

  describe('GET /api/v1/plants/:plantId', () => {
    it('returns a single plant by id', async () => {
      const plant = await createTestPlant({ name: 'Detail Plant', location: 'Balcony' });

      const res = await request(app).get(`/api/v1/plants/${plant.id}`);

      expect(res.status).toBe(200);
      expect(res.body.plant).toMatchObject({
        id: plant.id,
        name: 'Detail Plant',
        location: 'Balcony',
      });
    });

    it('returns 404 for a nonexistent plant', async () => {
      const res = await request(app).get(`/api/v1/plants/${randomUUID()}`);
      expect(res.status).toBe(404);
    });

    it('returns 404 for a malformed plant id', async () => {
      const res = await request(app).get('/api/v1/plants/not-a-real-id');
      expect(res.status).toBe(404);
    });

    it('includes an empty devices array when no device is assigned', async () => {
      const plant = await createTestPlant();

      const res = await request(app).get(`/api/v1/plants/${plant.id}`);

      expect(res.status).toBe(200);
      expect(res.body.plant.devices).toEqual([]);
    });

    it('includes an enabled device assigned to the plant', async () => {
      const plant = await createTestPlant();
      const device = await createTestDevice(plant.id);

      const res = await request(app).get(`/api/v1/plants/${plant.id}`);

      expect(res.status).toBe(200);
      expect(res.body.plant.devices).toHaveLength(1);
      expect(res.body.plant.devices[0]).toMatchObject({
        id: device.id,
        identifier: device.identifier,
        enabled: true,
      });
      expect(res.body.plant.devices[0].credentialHash).toBeUndefined();
    });

    it('excludes a disabled device from the devices array', async () => {
      const plant = await createTestPlant();
      await createTestDevice(plant.id, { enabled: false });

      const res = await request(app).get(`/api/v1/plants/${plant.id}`);

      expect(res.status).toBe(200);
      expect(res.body.plant.devices).toEqual([]);
    });

    it('includes only the enabled device when a plant has one enabled and one disabled device', async () => {
      const plant = await createTestPlant();
      const enabledDevice = await createTestDevice(plant.id, { enabled: true });
      await createTestDevice(plant.id, { enabled: false });

      const res = await request(app).get(`/api/v1/plants/${plant.id}`);

      expect(res.body.plant.devices).toHaveLength(1);
      expect(res.body.plant.devices[0].id).toBe(enabledDevice.id);
    });
  });
});

describe('POST /api/v1/plants/:plantId/device', () => {
  const createdPlantIds: string[] = [];
  const createdDeviceIds: string[] = [];
  const createdReadingIds: string[] = [];

  afterEach(async () => {
    if (createdReadingIds.length > 0) {
      await prisma.sensorReading.deleteMany({ where: { id: { in: createdReadingIds } } });
      createdReadingIds.length = 0;
    }
    if (createdDeviceIds.length > 0) {
      await prisma.device.deleteMany({ where: { id: { in: createdDeviceIds } } });
      createdDeviceIds.length = 0;
    }
    if (createdPlantIds.length > 0) {
      await prisma.plant.deleteMany({ where: { id: { in: createdPlantIds } } });
      createdPlantIds.length = 0;
    }
  });

  async function createTestPlant(overrides: Partial<Record<string, unknown>> = {}) {
    const plant = await prisma.plant.create({
      data: { name: 'Assignment Test Plant', ...overrides },
    });
    createdPlantIds.push(plant.id);
    return plant;
  }

  async function createTestDevice(overrides: Partial<Record<string, unknown>> = {}) {
    const device = await prisma.device.create({
      data: {
        name: 'Assignment Test Device',
        identifier: `assignment-test-device-${randomUUID()}`,
        credentialHash: hashDeviceCredential('unused'),
        enabled: true,
        ...overrides,
      },
    });
    createdDeviceIds.push(device.id);
    return device;
  }

  function assign(targetPlantId: string, body: unknown) {
    return request(app).post(`/api/v1/plants/${targetPlantId}/device`).send(body);
  }

  it('assigns an enabled, unassigned device to a plant', async () => {
    const plant = await createTestPlant();
    const device = await createTestDevice();

    const res = await assign(plant.id, { deviceId: device.id });

    expect(res.status).toBe(200);
    expect(res.body.device.id).toBe(device.id);
    expect(res.body.device.plantId).toBe(plant.id);

    const stored = await prisma.device.findUnique({ where: { id: device.id } });
    expect(stored?.plantId).toBe(plant.id);
  });

  it('never returns credentialHash', async () => {
    const plant = await createTestPlant();
    const device = await createTestDevice();

    const res = await assign(plant.id, { deviceId: device.id });
    expect(res.body.device.credentialHash).toBeUndefined();
  });

  it('rejects assigning a disabled device', async () => {
    const plant = await createTestPlant();
    const device = await createTestDevice({ enabled: false });

    const res = await assign(plant.id, { deviceId: device.id });

    expect(res.status).toBe(409);

    const stored = await prisma.device.findUnique({ where: { id: device.id } });
    expect(stored?.plantId).toBeNull();
  });

  it('rejects moving an already-assigned device to a different plant without reassign', async () => {
    const originalPlant = await createTestPlant({ name: 'Original Plant' });
    const newPlant = await createTestPlant({ name: 'New Plant' });
    const device = await createTestDevice({ plantId: originalPlant.id });

    const res = await assign(newPlant.id, { deviceId: device.id });

    expect(res.status).toBe(409);
    expect(res.body.error.details).toMatchObject({ currentPlantId: originalPlant.id });

    // The device must not have silently moved.
    const stored = await prisma.device.findUnique({ where: { id: device.id } });
    expect(stored?.plantId).toBe(originalPlant.id);
  });

  it('reassigns to a different plant when reassign is true, closing the previous assignment', async () => {
    const originalPlant = await createTestPlant({ name: 'Original Plant' });
    const newPlant = await createTestPlant({ name: 'New Plant' });
    const device = await createTestDevice({ plantId: originalPlant.id });

    const res = await assign(newPlant.id, { deviceId: device.id, reassign: true });

    expect(res.status).toBe(200);
    expect(res.body.device.plantId).toBe(newPlant.id);

    // A device has exactly one current plantId -- the previous assignment
    // is "closed" simply by no longer being that value.
    const stored = await prisma.device.findUnique({ where: { id: device.id } });
    expect(stored?.plantId).toBe(newPlant.id);
    expect(stored?.plantId).not.toBe(originalPlant.id);
  });

  it('keeps historical readings tied to their original plant after reassignment', async () => {
    const originalPlant = await createTestPlant({ name: 'Original Plant' });
    const newPlant = await createTestPlant({ name: 'New Plant' });
    const device = await createTestDevice({ plantId: originalPlant.id });

    const reading = await prisma.sensorReading.create({
      data: {
        id: randomUUID(),
        deviceId: device.id,
        plantId: originalPlant.id,
        recordedAt: new Date(),
        rawMoisture: 2048,
        moisturePercent: 45.5,
      },
    });
    createdReadingIds.push(reading.id);

    const res = await assign(newPlant.id, { deviceId: device.id, reassign: true });
    expect(res.status).toBe(200);

    const storedReading = await prisma.sensorReading.findUniqueOrThrow({
      where: { id: reading.id },
    });
    expect(storedReading.plantId).toBe(originalPlant.id);
    expect(storedReading.plantId).not.toBe(newPlant.id);
  });

  it('allows reassigning to the same plant it is already assigned to, without reassign', async () => {
    const plant = await createTestPlant();
    const device = await createTestDevice({ plantId: plant.id });

    const res = await assign(plant.id, { deviceId: device.id });

    expect(res.status).toBe(200);
    expect(res.body.device.plantId).toBe(plant.id);
  });

  it('rejects a nonexistent plant id with 404', async () => {
    const device = await createTestDevice();

    const res = await assign(randomUUID(), { deviceId: device.id });
    expect(res.status).toBe(404);
  });

  it('rejects a nonexistent device id with 404', async () => {
    const plant = await createTestPlant();

    const res = await assign(plant.id, { deviceId: randomUUID() });
    expect(res.status).toBe(404);
  });

  it('rejects a missing deviceId with a standard-format field error', async () => {
    const plant = await createTestPlant();

    const res = await assign(plant.id, {});

    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'deviceId' })]),
    );
  });
});

describe('care events (POST/GET/PATCH/DELETE /api/v1/plants/:plantId/care-events)', () => {
  const createdPlantIds: string[] = [];

  afterEach(async () => {
    if (createdPlantIds.length > 0) {
      // Cascades to the plant's care events too -- CareEvent has no
      // ON DELETE CASCADE (matches SensorReading's RESTRICT), so they're
      // cleaned up explicitly first.
      await prisma.careEvent.deleteMany({ where: { plantId: { in: createdPlantIds } } });
      await prisma.plant.deleteMany({ where: { id: { in: createdPlantIds } } });
      createdPlantIds.length = 0;
    }
  });

  async function createTestPlant(overrides: Partial<Record<string, unknown>> = {}) {
    const plant = await prisma.plant.create({
      data: { name: 'Care Event Test Plant', ...overrides },
    });
    createdPlantIds.push(plant.id);
    return plant;
  }

  function createEvent(plantId: string, body: unknown) {
    return request(app).post(`/api/v1/plants/${plantId}/care-events`).send(body);
  }
  function listEvents(plantId: string) {
    return request(app).get(`/api/v1/plants/${plantId}/care-events`);
  }
  function updateEvent(plantId: string, careEventId: string, body: unknown) {
    return request(app).patch(`/api/v1/plants/${plantId}/care-events/${careEventId}`).send(body);
  }
  function deleteEvent(plantId: string, careEventId: string) {
    return request(app).delete(`/api/v1/plants/${plantId}/care-events/${careEventId}`);
  }

  describe('create', () => {
    it('creates a watering event and returns 201 with the full record', async () => {
      const plant = await createTestPlant();

      const res = await createEvent(plant.id, {
        type: 'WATERING',
        occurredAt: '2026-01-01T12:00:00Z',
        amount: 250,
        unit: 'ml',
        notes: 'morning watering',
      });

      expect(res.status).toBe(201);
      expect(res.body.careEvent).toMatchObject({
        plantId: plant.id,
        type: 'WATERING',
        amount: 250,
        unit: 'ml',
        notes: 'morning watering',
      });
      expect(res.body.careEvent.occurredAt).toBe('2026-01-01T12:00:00.000Z');
      expect(res.body.careEvent.deletedAt).toBeNull();
    });

    it('defaults occurredAt to now when omitted', async () => {
      const plant = await createTestPlant();
      const before = Date.now();

      const res = await createEvent(plant.id, { type: 'WATERING' });
      const after = Date.now();

      expect(res.status).toBe(201);
      const occurredAtMs = new Date(res.body.careEvent.occurredAt).getTime();
      expect(occurredAtMs).toBeGreaterThanOrEqual(before);
      expect(occurredAtMs).toBeLessThanOrEqual(after);
    });

    it('creates an event with only the required type -- amount, unit, notes all optional', async () => {
      const plant = await createTestPlant();

      const res = await createEvent(plant.id, { type: 'WATERING' });

      expect(res.status).toBe(201);
      expect(res.body.careEvent.amount).toBeNull();
      expect(res.body.careEvent.unit).toBeNull();
      expect(res.body.careEvent.notes).toBeNull();
    });

    it('rejects a missing type with a standard-format field error', async () => {
      const plant = await createTestPlant();
      const res = await createEvent(plant.id, {});

      expect(res.status).toBe(400);
      expect(res.body.error.details).toEqual(
        expect.arrayContaining([expect.objectContaining({ field: 'type' })]),
      );
    });

    it('rejects an unsupported event type', async () => {
      const plant = await createTestPlant();
      const res = await createEvent(plant.id, { type: 'FERTILIZING' });
      expect(res.status).toBe(400);
    });

    it('rejects a negative amount', async () => {
      const plant = await createTestPlant();
      const res = await createEvent(plant.id, { type: 'WATERING', amount: -50 });

      expect(res.status).toBe(400);
      expect(res.body.error.details).toEqual(
        expect.arrayContaining([expect.objectContaining({ field: 'amount' })]),
      );
    });

    it('accepts a zero amount', async () => {
      const plant = await createTestPlant();
      const res = await createEvent(plant.id, { type: 'WATERING', amount: 0 });
      expect(res.status).toBe(201);
    });

    it('rejects a nonexistent plant with 404', async () => {
      const res = await createEvent(randomUUID(), { type: 'WATERING' });
      expect(res.status).toBe(404);
    });

    it('does not create an event when validation fails', async () => {
      const plant = await createTestPlant();
      await createEvent(plant.id, { type: 'WATERING', amount: -1 });

      const count = await prisma.careEvent.count({ where: { plantId: plant.id } });
      expect(count).toBe(0);
    });
  });

  describe('list', () => {
    it('returns events for a plant, newest occurredAt first', async () => {
      const plant = await createTestPlant();
      const older = await createEvent(plant.id, {
        type: 'WATERING',
        occurredAt: '2026-01-01T00:00:00Z',
      });
      const newer = await createEvent(plant.id, {
        type: 'WATERING',
        occurredAt: '2026-01-03T00:00:00Z',
      });

      const res = await listEvents(plant.id);

      expect(res.status).toBe(200);
      expect(res.body.careEvents.map((e: { id: string }) => e.id)).toEqual([
        newer.body.careEvent.id,
        older.body.careEvent.id,
      ]);
    });

    it('returns an empty list for a plant with no events', async () => {
      const plant = await createTestPlant();
      const res = await listEvents(plant.id);

      expect(res.status).toBe(200);
      expect(res.body.careEvents).toEqual([]);
    });

    it('excludes soft-deleted events', async () => {
      const plant = await createTestPlant();
      const created = await createEvent(plant.id, { type: 'WATERING' });

      await deleteEvent(plant.id, created.body.careEvent.id);

      const res = await listEvents(plant.id);
      expect(res.body.careEvents).toEqual([]);
    });

    it('returns 404 for a nonexistent plant', async () => {
      const res = await listEvents(randomUUID());
      expect(res.status).toBe(404);
    });
  });

  describe('update', () => {
    it('updates an event and returns the full updated record', async () => {
      const plant = await createTestPlant();
      const created = await createEvent(plant.id, {
        type: 'WATERING',
        amount: 100,
        unit: 'ml',
      });

      const res = await updateEvent(plant.id, created.body.careEvent.id, {
        amount: 300,
        notes: 'topped up',
      });

      expect(res.status).toBe(200);
      expect(res.body.careEvent).toMatchObject({
        id: created.body.careEvent.id,
        amount: 300,
        unit: 'ml',
        notes: 'topped up',
      });
    });

    it('persists the update', async () => {
      const plant = await createTestPlant();
      const created = await createEvent(plant.id, { type: 'WATERING', amount: 100 });

      await updateEvent(plant.id, created.body.careEvent.id, { amount: 200 });

      const stored = await prisma.careEvent.findUniqueOrThrow({
        where: { id: created.body.careEvent.id },
      });
      expect(stored.amount).toBe(200);
    });

    it('rejects an empty update payload', async () => {
      const plant = await createTestPlant();
      const created = await createEvent(plant.id, { type: 'WATERING' });

      const res = await updateEvent(plant.id, created.body.careEvent.id, {});
      expect(res.status).toBe(400);
    });

    it('rejects a negative amount', async () => {
      const plant = await createTestPlant();
      const created = await createEvent(plant.id, { type: 'WATERING' });

      const res = await updateEvent(plant.id, created.body.careEvent.id, { amount: -10 });
      expect(res.status).toBe(400);
    });

    it('returns 404 for a nonexistent event', async () => {
      const plant = await createTestPlant();
      const res = await updateEvent(plant.id, randomUUID(), { amount: 50 });
      expect(res.status).toBe(404);
    });

    it('returns 404 when the event belongs to a different plant', async () => {
      const plantA = await createTestPlant({ name: 'Plant A' });
      const plantB = await createTestPlant({ name: 'Plant B' });
      const created = await createEvent(plantA.id, { type: 'WATERING' });

      const res = await updateEvent(plantB.id, created.body.careEvent.id, { amount: 50 });
      expect(res.status).toBe(404);

      // The event itself must be untouched by the mismatched-plant attempt.
      const stored = await prisma.careEvent.findUniqueOrThrow({
        where: { id: created.body.careEvent.id },
      });
      expect(stored.amount).toBeNull();
    });

    it('returns 404 when updating an already soft-deleted event', async () => {
      const plant = await createTestPlant();
      const created = await createEvent(plant.id, { type: 'WATERING' });
      await deleteEvent(plant.id, created.body.careEvent.id);

      const res = await updateEvent(plant.id, created.body.careEvent.id, { amount: 50 });
      expect(res.status).toBe(404);
    });
  });

  describe('delete', () => {
    it('soft-deletes an event and returns 204', async () => {
      const plant = await createTestPlant();
      const created = await createEvent(plant.id, { type: 'WATERING' });

      const res = await deleteEvent(plant.id, created.body.careEvent.id);
      expect(res.status).toBe(204);
    });

    it('keeps the row in the database with deletedAt set, rather than removing it', async () => {
      const plant = await createTestPlant();
      const created = await createEvent(plant.id, { type: 'WATERING' });

      await deleteEvent(plant.id, created.body.careEvent.id);

      const stored = await prisma.careEvent.findUnique({
        where: { id: created.body.careEvent.id },
      });
      expect(stored).not.toBeNull();
      expect(stored?.deletedAt).not.toBeNull();
    });

    it('returns 404 for a nonexistent event', async () => {
      const plant = await createTestPlant();
      const res = await deleteEvent(plant.id, randomUUID());
      expect(res.status).toBe(404);
    });

    it('returns 404 when the event belongs to a different plant', async () => {
      const plantA = await createTestPlant({ name: 'Plant A' });
      const plantB = await createTestPlant({ name: 'Plant B' });
      const created = await createEvent(plantA.id, { type: 'WATERING' });

      const res = await deleteEvent(plantB.id, created.body.careEvent.id);
      expect(res.status).toBe(404);

      const stored = await prisma.careEvent.findUniqueOrThrow({
        where: { id: created.body.careEvent.id },
      });
      expect(stored.deletedAt).toBeNull();
    });

    it('returns 404 when deleting an already-deleted event (not idempotent-success)', async () => {
      const plant = await createTestPlant();
      const created = await createEvent(plant.id, { type: 'WATERING' });
      await deleteEvent(plant.id, created.body.careEvent.id);

      const res = await deleteEvent(plant.id, created.body.careEvent.id);
      expect(res.status).toBe(404);
    });
  });
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
      expect.arrayContaining([expect.objectContaining({ field: 'start' })]),
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
