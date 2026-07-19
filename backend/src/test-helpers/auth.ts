import { randomUUID } from 'node:crypto';
import { prisma } from '../db';
import { hashPassword } from '../lib/user-credential';
import { signUserToken } from '../lib/jwt';

// Shared across every test file that needs a real, DB-backed user to
// satisfy the required userId FK on Plant/Device (and an Authorization
// header for routes behind userAuthMiddleware) -- avoids repeating this
// boilerplate in every beforeEach across plants.test.ts/devices.test.ts/
// readings.test.ts and friends.
export async function createTestUserAndToken(): Promise<{
  userId: string;
  email: string;
  token: string;
}> {
  const email = `test-user-${randomUUID()}@example.com`;

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: hashPassword('irrelevant-test-password'),
    },
  });

  const token = signUserToken({ sub: user.id, email: user.email });

  return { userId: user.id, email: user.email, token };
}

export function authHeader(token: string): [string, string] {
  return ['Authorization', `Bearer ${token}`];
}
