import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { signUserToken } from '../lib/jwt';
import { AppError } from '../http/errors';
import { userAuthMiddleware } from './user-auth';

function buildTestApp() {
  const app = express();

  app.get('/protected', userAuthMiddleware, (req, res) => {
    res.status(200).json({ ok: true, user: req.user });
  });

  app.use(
    (err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      if (err instanceof AppError) {
        res.status(err.statusCode).json({ error: { message: err.message } });
        return;
      }
      res.status(500).json({ error: { message: 'Internal server error' } });
    },
  );

  return app;
}

describe('userAuthMiddleware', () => {
  it('returns 401 when the Authorization header is missing', async () => {
    const res = await request(buildTestApp()).get('/protected');
    expect(res.status).toBe(401);
  });

  it('returns 401 when the Authorization header has no Bearer prefix', async () => {
    const token = signUserToken({ sub: 'user-1', email: 'a@example.com' });
    const res = await request(buildTestApp()).get('/protected').set('Authorization', token);
    expect(res.status).toBe(401);
  });

  it('returns 401 for a malformed token', async () => {
    const res = await request(buildTestApp())
      .get('/protected')
      .set('Authorization', 'Bearer not-a-real-token');
    expect(res.status).toBe(401);
  });

  it('returns 401 for a token signed with the wrong secret', async () => {
    const forged = jwt.sign({ sub: 'user-1', email: 'a@example.com' }, 'wrong-secret', {
      algorithm: 'HS256',
    });
    const res = await request(buildTestApp())
      .get('/protected')
      .set('Authorization', `Bearer ${forged}`);
    expect(res.status).toBe(401);
  });

  it('attaches the authenticated user to the request and calls next() on success', async () => {
    const token = signUserToken({ sub: 'user-1', email: 'a@example.com' });
    const res = await request(buildTestApp())
      .get('/protected')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.user).toEqual({ id: 'user-1', email: 'a@example.com' });
  });
});
