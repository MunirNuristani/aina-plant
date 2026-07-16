import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../app';
import { prisma } from '../db';

const app = createApp();

function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    name: 'Test Device',
    identifier: `registration-test-device-${randomUUID()}`,
    ...overrides,
  };
}

afterEach(async () => {
  // Registration tests create their own devices with unique
  // randomUUID()-suffixed identifiers, so a blanket prefix match cleans up
  // everything each test created without needing per-test bookkeeping.
  // Prefix is deliberately distinct from device-auth.test.ts's
  // "test-device-" identifiers -- these test files run concurrently
  // against the same database, and a shared prefix would let this
  // cleanup delete the other file's in-flight rows.
  await prisma.device.deleteMany({
    where: { identifier: { startsWith: 'registration-test-device-' } },
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('POST /devices', () => {
  it('registers a unique device and returns 201', async () => {
    const payload = validPayload();
    const res = await request(app).post('/devices').send(payload);

    expect(res.status).toBe(201);
    expect(res.body.device.name).toBe(payload.name);
    expect(res.body.device.identifier).toBe(payload.identifier);
    expect(res.body.device.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );

    const stored = await prisma.device.findUnique({ where: { identifier: payload.identifier } });
    expect(stored).not.toBeNull();
  });

  it('is enabled by default', async () => {
    const res = await request(app).post('/devices').send(validPayload());
    expect(res.body.device.enabled).toBe(true);
  });

  it('stores the default reporting interval when none is provided', async () => {
    const res = await request(app).post('/devices').send(validPayload());
    expect(res.body.device.reportingIntervalSeconds).toBe(900);
  });

  it('stores a provided reporting interval instead of the default', async () => {
    const res = await request(app)
      .post('/devices')
      .send(validPayload({ reportingIntervalSeconds: 300 }));

    expect(res.status).toBe(201);
    expect(res.body.device.reportingIntervalSeconds).toBe(300);
  });

  it('stores an optional firmwareVersion when provided', async () => {
    const res = await request(app).post('/devices').send(validPayload({ firmwareVersion: '1.2.3' }));
    expect(res.body.device.firmwareVersion).toBe('1.2.3');
  });

  it('returns a device key once, alongside the device, and never as part of the device object', async () => {
    const res = await request(app).post('/devices').send(validPayload());

    expect(res.status).toBe(201);
    expect(typeof res.body.credential).toBe('string');
    expect(res.body.credential.length).toBeGreaterThan(0);

    // The plaintext key is a sibling of `device`, not a field on it -- and
    // the stored hash must never be exposed at all.
    expect(res.body.device.credential).toBeUndefined();
    expect(res.body.device.credentialHash).toBeUndefined();
  });

  it('issues a credential that actually authenticates the newly registered device', async () => {
    const payload = validPayload();
    const registerRes = await request(app).post('/devices').send(payload);
    expect(registerRes.status).toBe(201);

    const authRes = await request(app)
      .post('/devices/auth')
      .send({ identifier: payload.identifier, credential: registerRes.body.credential });

    expect(authRes.status).toBe(200);
    expect(authRes.body.device.id).toBe(registerRes.body.device.id);
  });

  it('rejects a duplicate identifier with 409', async () => {
    const payload = validPayload();
    const first = await request(app).post('/devices').send(payload);
    expect(first.status).toBe(201);

    const second = await request(app).post('/devices').send(validPayload({ identifier: payload.identifier }));
    expect(second.status).toBe(409);

    const count = await prisma.device.count({ where: { identifier: payload.identifier } });
    expect(count).toBe(1);
  });

  it('handles two concurrent registrations of the same identifier as one create and one rejection', async () => {
    const payload = validPayload();

    const [first, second] = await Promise.all([
      request(app).post('/devices').send(payload),
      request(app).post('/devices').send(payload),
    ]);

    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([201, 409]);

    const count = await prisma.device.count({ where: { identifier: payload.identifier } });
    expect(count).toBe(1);
  });

  it('returns 400 with standard-format field errors for a missing name', async () => {
    const payload = validPayload();
    delete (payload as Record<string, unknown>).name;

    const res = await request(app).post('/devices').send(payload);

    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'name' })]),
    );
  });

  it('returns 400 with standard-format field errors for a missing identifier', async () => {
    const payload = validPayload();
    delete (payload as Record<string, unknown>).identifier;

    const res = await request(app).post('/devices').send(payload);

    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'identifier' })]),
    );
  });

  it('rejects an empty name', async () => {
    const res = await request(app).post('/devices').send(validPayload({ name: '' }));
    expect(res.status).toBe(400);
  });

  it('rejects a name over 100 characters', async () => {
    const res = await request(app).post('/devices').send(validPayload({ name: 'x'.repeat(101) }));
    expect(res.status).toBe(400);
  });

  it('rejects a non-positive reporting interval', async () => {
    const res = await request(app)
      .post('/devices')
      .send(validPayload({ reportingIntervalSeconds: 0 }));
    expect(res.status).toBe(400);
  });

  it('rejects a non-integer reporting interval', async () => {
    const res = await request(app)
      .post('/devices')
      .send(validPayload({ reportingIntervalSeconds: 12.5 }));
    expect(res.status).toBe(400);
  });

  it('does not create a device when validation fails', async () => {
    const payload = validPayload({ name: '' });
    await request(app).post('/devices').send(payload);

    const stored = await prisma.device.findUnique({ where: { identifier: payload.identifier } });
    expect(stored).toBeNull();
  });
});
