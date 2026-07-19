import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const SALT_BYTES = 16;
const KEY_LENGTH = 64;

function hashWithSalt(password: string, salt: string): string {
  const derivedKey = scryptSync(password, salt, KEY_LENGTH).toString('hex');
  return `${salt}:${derivedKey}`;
}

export function hashPassword(password: string): string {
  const salt = randomBytes(SALT_BYTES).toString('hex');
  return hashWithSalt(password, salt);
}

export function verifyPassword(candidatePassword: string, storedHash: string): boolean {
  const [salt, expectedKeyHex] = storedHash.split(':');
  if (!salt || !expectedKeyHex) {
    return false;
  }

  const candidateKey = scryptSync(candidatePassword, salt, KEY_LENGTH);
  const expectedKey = Buffer.from(expectedKeyHex, 'hex');

  return candidateKey.length === expectedKey.length && timingSafeEqual(candidateKey, expectedKey);
}
