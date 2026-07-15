import { randomBytes, scryptSync } from 'node:crypto';

const SECRET_BYTES = 32;
const SALT_BYTES = 16;
const KEY_LENGTH = 64;

export function generateDeviceCredential(): { secret: string; hash: string } {
  const secret = randomBytes(SECRET_BYTES).toString('hex');
  const salt = randomBytes(SALT_BYTES).toString('hex');
  const derivedKey = scryptSync(secret, salt, KEY_LENGTH).toString('hex');

  return { secret, hash: `${salt}:${derivedKey}` };
}
