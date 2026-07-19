import jwt from 'jsonwebtoken';
import { config } from '../config';
import { UnauthorizedError } from '../http/errors';

// Shared contract with frontend/proxy.ts, which verifies the same tokens
// via `jose` (Edge/Node-runtime JWT library, not Node's `jsonwebtoken`).
// Both sides sign/verify HS256 against JWT_SECRET with this exact claim
// shape -- `sub` is the userId, `email` is included so proxy.ts can make
// UX decisions without a DB round trip. Keep the two sides in sync if this
// shape ever changes.
export type UserTokenPayload = {
  sub: string;
  email: string;
};

const JWT_ALGORITHM = 'HS256';
const JWT_EXPIRES_IN = '30d';

export function signUserToken(user: UserTokenPayload): string {
  return jwt.sign({ sub: user.sub, email: user.email }, config.JWT_SECRET, {
    algorithm: JWT_ALGORITHM,
    expiresIn: JWT_EXPIRES_IN,
  });
}

export function verifyUserToken(token: string): UserTokenPayload {
  try {
    const decoded = jwt.verify(token, config.JWT_SECRET, { algorithms: [JWT_ALGORITHM] });

    if (typeof decoded === 'string' || typeof decoded.sub !== 'string' || typeof decoded.email !== 'string') {
      throw new UnauthorizedError('Invalid token payload');
    }

    return { sub: decoded.sub, email: decoded.email };
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      throw error;
    }
    throw new UnauthorizedError('Invalid or expired token');
  }
}
