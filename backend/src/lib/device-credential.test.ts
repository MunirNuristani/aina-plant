// A minimal, self-contained example test: no database, no environment
// variables, no network — just the pure functions in device-credential.ts.
// See README.md's "Testing" section for what other tests require.

import { describe, expect, it } from 'vitest';
import {
  generateDeviceCredential,
  hashDeviceCredential,
  verifyDeviceCredential,
} from './device-credential';

describe('generateDeviceCredential', () => {
  it('produces a secret whose hash verifies correctly', () => {
    const { secret, hash } = generateDeviceCredential();
    expect(verifyDeviceCredential(secret, hash)).toBe(true);
  });

  it('produces a different secret and hash on every call', () => {
    const first = generateDeviceCredential();
    const second = generateDeviceCredential();

    expect(first.secret).not.toBe(second.secret);
    expect(first.hash).not.toBe(second.hash);
  });

  it('stores the hash as "salt:derivedKey", both hex', () => {
    const { hash } = generateDeviceCredential();
    const parts = hash.split(':');

    expect(parts).toHaveLength(2);
    expect(parts[0]).toMatch(/^[0-9a-f]+$/);
    expect(parts[1]).toMatch(/^[0-9a-f]+$/);
  });
});

describe('hashDeviceCredential', () => {
  it('hashes a known secret so it verifies against that same secret', () => {
    const hash = hashDeviceCredential('a-known-secret');
    expect(verifyDeviceCredential('a-known-secret', hash)).toBe(true);
  });

  it('produces a different hash each time, even for the same secret (random salt)', () => {
    const first = hashDeviceCredential('same-secret');
    const second = hashDeviceCredential('same-secret');

    expect(first).not.toBe(second);
    expect(verifyDeviceCredential('same-secret', first)).toBe(true);
    expect(verifyDeviceCredential('same-secret', second)).toBe(true);
  });
});

describe('verifyDeviceCredential', () => {
  it('rejects the wrong secret', () => {
    const hash = hashDeviceCredential('correct-secret');
    expect(verifyDeviceCredential('wrong-secret', hash)).toBe(false);
  });

  it.each(['', 'no-colon-here', ':missing-salt', 'missing-key:'])(
    'rejects a malformed stored hash without throwing (%s)',
    (malformedHash) => {
      expect(() => verifyDeviceCredential('any-secret', malformedHash)).not.toThrow();
      expect(verifyDeviceCredential('any-secret', malformedHash)).toBe(false);
    },
  );
});
