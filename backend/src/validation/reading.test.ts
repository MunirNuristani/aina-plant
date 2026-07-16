import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { sensorReadingSchema } from './reading';

function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    readingId: randomUUID(),
    deviceId: randomUUID(),
    recordedAt: '2026-07-16T10:00:00Z',
    rawMoisture: 2048,
    moisturePercent: 45.5,
    firmwareVersion: '1.2.3',
    wifiRssi: -63,
    ...overrides,
  };
}

function fieldErrors(result: ReturnType<typeof sensorReadingSchema.safeParse>) {
  if (result.success) return [];
  return result.error.issues.map((issue) => issue.path.join('.'));
}

describe('sensorReadingSchema', () => {
  it('accepts a fully valid payload', () => {
    const result = sensorReadingSchema.safeParse(validPayload());
    expect(result.success).toBe(true);
  });

  it('accepts a valid payload without the optional fields', () => {
    const payload = validPayload();
    delete (payload as Record<string, unknown>).firmwareVersion;
    delete (payload as Record<string, unknown>).wifiRssi;

    const result = sensorReadingSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });

  it('identifies every missing required field', () => {
    const result = sensorReadingSchema.safeParse({});
    expect(result.success).toBe(false);
    expect(fieldErrors(result)).toEqual(
      expect.arrayContaining([
        'readingId',
        'deviceId',
        'recordedAt',
        'rawMoisture',
        'moisturePercent',
      ]),
    );
  });

  it('rejects a non-UUID readingId', () => {
    const result = sensorReadingSchema.safeParse(validPayload({ readingId: 'not-a-uuid' }));
    expect(result.success).toBe(false);
    expect(fieldErrors(result)).toEqual(['readingId']);
  });

  it('rejects a non-UUID deviceId', () => {
    const result = sensorReadingSchema.safeParse(validPayload({ deviceId: 'not-a-uuid' }));
    expect(result.success).toBe(false);
    expect(fieldErrors(result)).toEqual(['deviceId']);
  });

  it.each([
    ['plain date, no time', '2026-07-16'],
    ['missing timezone', '2026-07-16T10:00:00'],
    ['non-UTC offset', '2026-07-16T10:00:00+02:00'],
    ['not a date at all', 'not-a-timestamp'],
  ])('rejects an invalid recordedAt (%s)', (_label, recordedAt) => {
    const result = sensorReadingSchema.safeParse(validPayload({ recordedAt }));
    expect(result.success).toBe(false);
    expect(fieldErrors(result)).toEqual(['recordedAt']);
  });

  it('accepts recordedAt with fractional seconds', () => {
    const result = sensorReadingSchema.safeParse(
      validPayload({ recordedAt: '2026-07-16T10:00:00.123Z' }),
    );
    expect(result.success).toBe(true);
  });

  it.each([
    ['below range', -1],
    ['above range', 4096],
    ['non-integer', 100.5],
  ])('rejects an out-of-range rawMoisture (%s)', (_label, rawMoisture) => {
    const result = sensorReadingSchema.safeParse(validPayload({ rawMoisture }));
    expect(result.success).toBe(false);
    expect(fieldErrors(result)).toEqual(['rawMoisture']);
  });

  it.each([
    [0, true],
    [4095, true],
    [-1, false],
    [4096, false],
  ])('rawMoisture boundary %d is valid=%s', (rawMoisture, shouldBeValid) => {
    const result = sensorReadingSchema.safeParse(validPayload({ rawMoisture }));
    expect(result.success).toBe(shouldBeValid);
  });

  it('rejects a non-number rawMoisture', () => {
    const result = sensorReadingSchema.safeParse(validPayload({ rawMoisture: '2048' }));
    expect(result.success).toBe(false);
    expect(fieldErrors(result)).toEqual(['rawMoisture']);
  });

  it.each([
    ['below range', -0.1],
    ['above range', 100.1],
  ])('rejects an out-of-range moisturePercent (%s)', (_label, moisturePercent) => {
    const result = sensorReadingSchema.safeParse(validPayload({ moisturePercent }));
    expect(result.success).toBe(false);
    expect(fieldErrors(result)).toEqual(['moisturePercent']);
  });

  it.each([
    [0, true],
    [100, true],
    [-0.1, false],
    [100.1, false],
  ])('moisturePercent boundary %d is valid=%s', (moisturePercent, shouldBeValid) => {
    const result = sensorReadingSchema.safeParse(validPayload({ moisturePercent }));
    expect(result.success).toBe(shouldBeValid);
  });

  it.each([
    ['missing patch version', '1.2'],
    ['non-numeric', 'v1.2.3'],
    ['empty string', ''],
  ])('rejects an invalid firmwareVersion (%s)', (_label, firmwareVersion) => {
    const result = sensorReadingSchema.safeParse(validPayload({ firmwareVersion }));
    expect(result.success).toBe(false);
    expect(fieldErrors(result)).toEqual(['firmwareVersion']);
  });

  it.each(['1.2.3', '1.2.3-beta', '1.2.3+build.7'])(
    'accepts a valid firmwareVersion (%s)',
    (firmwareVersion) => {
      const result = sensorReadingSchema.safeParse(validPayload({ firmwareVersion }));
      expect(result.success).toBe(true);
    },
  );

  it.each([
    ['above range (positive)', 5],
    ['below range', -101],
    ['non-integer', -63.5],
  ])('rejects an out-of-range wifiRssi (%s)', (_label, wifiRssi) => {
    const result = sensorReadingSchema.safeParse(validPayload({ wifiRssi }));
    expect(result.success).toBe(false);
    expect(fieldErrors(result)).toEqual(['wifiRssi']);
  });

  it.each([
    [0, true],
    [-100, true],
    [1, false],
    [-101, false],
  ])('wifiRssi boundary %d is valid=%s', (wifiRssi, shouldBeValid) => {
    const result = sensorReadingSchema.safeParse(validPayload({ wifiRssi }));
    expect(result.success).toBe(shouldBeValid);
  });

  it('rejects wrong types for every field independently', () => {
    const payload = validPayload({
      readingId: 123,
      deviceId: 123,
      recordedAt: 123,
      rawMoisture: 'not-a-number',
      moisturePercent: 'not-a-number',
      wifiRssi: 'not-a-number',
    });

    const result = sensorReadingSchema.safeParse(payload);
    expect(result.success).toBe(false);
    expect(fieldErrors(result)).toEqual(
      expect.arrayContaining([
        'readingId',
        'deviceId',
        'recordedAt',
        'rawMoisture',
        'moisturePercent',
        'wifiRssi',
      ]),
    );
  });
});
