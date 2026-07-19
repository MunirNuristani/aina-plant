import jwt from 'jsonwebtoken';
import { describe, expect, it } from 'vitest';
import { UnauthorizedError } from '../http/errors';
import { signUserToken, verifyUserToken } from './jwt';

describe('signUserToken / verifyUserToken', () => {
  it('round-trips a payload signed by signUserToken', () => {
    const token = signUserToken({ sub: 'user-1', email: 'person@example.com' });
    const payload = verifyUserToken(token);

    expect(payload).toEqual({ sub: 'user-1', email: 'person@example.com' });
  });

  it('rejects a malformed token without throwing something other than UnauthorizedError', () => {
    expect(() => verifyUserToken('not-a-real-token')).toThrow(UnauthorizedError);
  });

  it('rejects a token signed with a different secret', () => {
    // Same shape, deliberately signed with a bogus secret via jsonwebtoken
    // directly, bypassing signUserToken's use of the real config secret.
    const forged = jwt.sign({ sub: 'user-1', email: 'person@example.com' }, 'wrong-secret', {
      algorithm: 'HS256',
    });

    expect(() => verifyUserToken(forged)).toThrow(UnauthorizedError);
  });

  it('rejects a token missing required claims', () => {
    const malformed = jwt.sign({ sub: 'user-1' }, process.env.JWT_SECRET as string, {
      algorithm: 'HS256',
    });

    expect(() => verifyUserToken(malformed)).toThrow(UnauthorizedError);
  });
});
