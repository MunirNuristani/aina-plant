import { prisma } from '../db';
import type { User } from '../generated/prisma/client';
import { hashPassword, verifyPassword } from '../lib/user-credential';
import { signUserToken } from '../lib/jwt';
import { isUniqueConstraintViolation } from '../lib/prisma-errors';
import { logger } from '../lib/logger';
import { ConflictError, UnauthorizedError } from '../http/errors';
import type { LoginInput, SignupInput } from '../validation/user';

export type PublicUser = Omit<User, 'passwordHash'>;

function toPublicUser(user: User): PublicUser {
  const { passwordHash: _passwordHash, ...publicUser } = user;
  return publicUser;
}

export async function signup(input: SignupInput): Promise<{ user: PublicUser; token: string }> {
  const passwordHash = hashPassword(input.password);

  try {
    const user = await prisma.user.create({
      data: {
        email: input.email,
        passwordHash,
        name: input.name,
      },
    });

    const token = signUserToken({ sub: user.id, email: user.email });
    return { user: toPublicUser(user), token };
  } catch (error) {
    if (isUniqueConstraintViolation(error)) {
      throw new ConflictError(`An account with email "${input.email}" already exists`);
    }
    throw error;
  }
}

export async function login(input: LoginInput): Promise<{ user: PublicUser; token: string }> {
  const user = await prisma.user.findUnique({ where: { email: input.email } });

  // Never log `password` here or anywhere below — only the email, which is
  // a lookup key, not a secret. Deliberately the same error for "no such
  // user" and "wrong password" — distinguishing them would let an
  // attacker enumerate registered emails.
  if (!user || !verifyPassword(input.password, user.passwordHash)) {
    logger.warn({ email: input.email }, 'login rejected: invalid credentials');
    throw new UnauthorizedError('Invalid email or password');
  }

  const token = signUserToken({ sub: user.id, email: user.email });
  return { user: toPublicUser(user), token };
}
