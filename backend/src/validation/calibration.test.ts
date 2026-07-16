import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { calibrationSchema } from './calibration';

function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    deviceId: randomUUID(),
    dryValue: 3000,
    wetValue: 1200,
    ...overrides,
  };
}

describe('calibrationSchema', () => {
  it('accepts a valid payload', () => {
    expect(calibrationSchema.safeParse(validPayload()).success).toBe(true);
  });

  it('accepts a valid payload without effectiveAt (optional)', () => {
    const result = calibrationSchema.safeParse(validPayload());
    expect(result.success).toBe(true);
  });

  it('accepts an explicit effectiveAt', () => {
    const result = calibrationSchema.safeParse(
      validPayload({ effectiveAt: '2026-01-01T00:00:00Z' }),
    );
    expect(result.success).toBe(true);
  });

  it('rejects equal dry and wet values', () => {
    const result = calibrationSchema.safeParse(validPayload({ dryValue: 2000, wetValue: 2000 }));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: ['wetValue'],
            message: 'dryValue and wetValue must not be equal',
          }),
        ]),
      );
    }
  });

  it('rejects equal dry and wet values at either end of the valid range', () => {
    expect(calibrationSchema.safeParse(validPayload({ dryValue: 0, wetValue: 0 })).success).toBe(
      false,
    );
    expect(
      calibrationSchema.safeParse(validPayload({ dryValue: 4095, wetValue: 4095 })).success,
    ).toBe(false);
  });

  it('identifies every missing required field', () => {
    const result = calibrationSchema.safeParse({});
    expect(result.success).toBe(false);
    if (!result.success) {
      const fields = result.error.issues.map((issue) => issue.path.join('.'));
      expect(fields).toEqual(expect.arrayContaining(['deviceId', 'dryValue', 'wetValue']));
    }
  });

  it('rejects a non-UUID deviceId', () => {
    const result = calibrationSchema.safeParse(validPayload({ deviceId: 'not-a-uuid' }));
    expect(result.success).toBe(false);
  });

  it.each([
    ['below range', -1],
    ['above range', 4096],
    ['non-integer', 100.5],
  ])('rejects an out-of-range dryValue (%s)', (_label, dryValue) => {
    const result = calibrationSchema.safeParse(validPayload({ dryValue }));
    expect(result.success).toBe(false);
  });

  it.each([
    ['below range', -1],
    ['above range', 4096],
    ['non-integer', 100.5],
  ])('rejects an out-of-range wetValue (%s)', (_label, wetValue) => {
    const result = calibrationSchema.safeParse(validPayload({ wetValue }));
    expect(result.success).toBe(false);
  });

  it.each([0, 4095])('accepts dry/wet values at the boundary (%d) when not equal', (boundary) => {
    const other = boundary === 0 ? 4095 : 0;
    const result = calibrationSchema.safeParse(
      validPayload({ dryValue: boundary, wetValue: other }),
    );
    expect(result.success).toBe(true);
  });

  it('rejects a malformed effectiveAt', () => {
    const result = calibrationSchema.safeParse(validPayload({ effectiveAt: 'not-a-timestamp' }));
    expect(result.success).toBe(false);
  });
});
