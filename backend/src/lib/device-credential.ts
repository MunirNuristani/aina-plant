import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const SECRET_BYTES = 32;
const SALT_BYTES = 16;
const KEY_LENGTH = 64;

function hashWithSalt(secret: string, salt: string): string {
  const derivedKey = scryptSync(secret, salt, KEY_LENGTH).toString('hex');
  return `${salt}:${derivedKey}`;
}

export function generateDeviceCredential(): { secret: string; hash: string } {
  const secret = randomBytes(SECRET_BYTES).toString('hex');
  const salt = randomBytes(SALT_BYTES).toString('hex');

  return { secret, hash: hashWithSalt(secret, salt) };
}

export function hashDeviceCredential(secret: string): string {
  const salt = randomBytes(SALT_BYTES).toString('hex');
  return hashWithSalt(secret, salt);
}

export function verifyDeviceCredential(candidateSecret: string, storedHash: string): boolean {
  const [salt, expectedKeyHex] = storedHash.split(':');
  if (!salt || !expectedKeyHex) {
    return false;
  }

  const candidateKey = scryptSync(candidateSecret, salt, KEY_LENGTH);
  const expectedKey = Buffer.from(expectedKeyHex, 'hex');

  return candidateKey.length === expectedKey.length && timingSafeEqual(candidateKey, expectedKey);
}
