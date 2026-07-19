// A minimal, self-contained example test: no database, no environment
// variables, no network — just the pure functions in user-credential.ts.
// See README.md's "Testing" section for what other tests require.

import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from './user-credential';

describe('hashPassword', () => {
  it('hashes a known password so it verifies against that same password', () => {
    const hash = hashPassword('a-known-password');
    expect(verifyPassword('a-known-password', hash)).toBe(true);
  });

  it('produces a different hash each time, even for the same password (random salt)', () => {
    const first = hashPassword('same-password');
    const second = hashPassword('same-password');

    expect(first).not.toBe(second);
    expect(verifyPassword('same-password', first)).toBe(true);
    expect(verifyPassword('same-password', second)).toBe(true);
  });

  it('stores the hash as "salt:derivedKey", both hex', () => {
    const hash = hashPassword('a-known-password');
    const parts = hash.split(':');

    expect(parts).toHaveLength(2);
    expect(parts[0]).toMatch(/^[0-9a-f]+$/);
    expect(parts[1]).toMatch(/^[0-9a-f]+$/);
  });
});

describe('verifyPassword', () => {
  it('rejects the wrong password', () => {
    const hash = hashPassword('correct-password');
    expect(verifyPassword('wrong-password', hash)).toBe(false);
  });

  it.each(['', 'no-colon-here', ':missing-salt', 'missing-key:'])(
    'rejects a malformed stored hash without throwing (%s)',
    (malformedHash) => {
      expect(() => verifyPassword('any-password', malformedHash)).not.toThrow();
      expect(verifyPassword('any-password', malformedHash)).toBe(false);
    },
  );
});
