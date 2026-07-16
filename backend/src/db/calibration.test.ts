import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from './index';

let deviceId: string;

beforeEach(async () => {
  const device = await prisma.device.create({
    data: {
      name: 'Calibration Test Device',
      identifier: `test-calibration-device-${randomUUID()}`,
      credentialHash: 'unused',
    },
  });
  deviceId = device.id;
});

afterEach(async () => {
  await prisma.calibration.deleteMany({ where: { deviceId } });
  await prisma.device.deleteMany({ where: { id: deviceId } });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('Calibration model', () => {
  it('belongs to a device, and stores the dry/wet values and effective timestamp', async () => {
    const calibration = await prisma.calibration.create({
      data: { deviceId, dryValue: 3000, wetValue: 1200 },
    });

    expect(calibration.deviceId).toBe(deviceId);
    expect(calibration.dryValue).toBe(3000);
    expect(calibration.wetValue).toBe(1200);
    expect(calibration.effectiveAt).toBeInstanceOf(Date);
  });

  it('can be retrieved immediately after creation', async () => {
    const created = await prisma.calibration.create({
      data: { deviceId, dryValue: 3000, wetValue: 1200 },
    });

    const fetched = await prisma.calibration.findUniqueOrThrow({ where: { id: created.id } });
    expect(fetched.id).toBe(created.id);
  });

  it('defaults effectiveAt to now, but accepts an explicit (e.g. back-dated) value', async () => {
    const before = Date.now();
    const defaulted = await prisma.calibration.create({
      data: { deviceId, dryValue: 3000, wetValue: 1200 },
    });
    const after = Date.now();

    expect(defaulted.effectiveAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(defaulted.effectiveAt.getTime()).toBeLessThanOrEqual(after);

    const backdated = await prisma.calibration.create({
      data: {
        deviceId,
        dryValue: 3100,
        wetValue: 1000,
        effectiveAt: new Date('2020-01-01T00:00:00Z'),
      },
    });
    expect(backdated.effectiveAt.toISOString()).toBe('2020-01-01T00:00:00.000Z');
  });

  it('supports multiple historical calibration records for the same device', async () => {
    const first = await prisma.calibration.create({
      data: {
        deviceId,
        dryValue: 3000,
        wetValue: 1200,
        effectiveAt: new Date('2026-01-01T00:00:00Z'),
      },
    });
    const second = await prisma.calibration.create({
      data: {
        deviceId,
        dryValue: 3100,
        wetValue: 1000,
        effectiveAt: new Date('2026-06-01T00:00:00Z'),
      },
    });

    const history = await prisma.calibration.findMany({
      where: { deviceId },
      orderBy: { effectiveAt: 'asc' },
    });

    expect(history.map((c) => c.id)).toEqual([first.id, second.id]);
  });
});
