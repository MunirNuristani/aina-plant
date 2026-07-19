import { randomUUID } from 'node:crypto';
import express from 'express';
import request from 'supertest';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../db';
import { hashDeviceCredential } from '../lib/device-credential';
import { logger } from '../lib/logger';
import { AppError } from '../http/errors';
import { createTestUserAndToken } from '../test-helpers/auth';
import { deviceAuthMiddleware } from './device-auth';

function buildTestApp() {
  const app = express();

  app.get('/protected', deviceAuthMiddleware, (req, res) => {
    res.status(200).json({ ok: true, device: req.device });
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

const SECRET = 'correct-test-secret';
let identifier: string;

beforeEach(async () => {
  const { userId } = await createTestUserAndToken();
  identifier = `test-device-${randomUUID()}`;
  await prisma.device.create({
    data: {
      name: 'Middleware Test Device',
      identifier,
      credentialHash: hashDeviceCredential(SECRET),
      enabled: true,
      userId,
    },
  });
});

afterEach(async () => {
  await prisma.device.deleteMany({ where: { identifier } });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('deviceAuthMiddleware', () => {
  it('returns 401 when both headers are missing', async () => {
    const res = await request(buildTestApp()).get('/protected');
    expect(res.status).toBe(401);
  });

  it('returns 401 when X-Device-Key is missing', async () => {
    const res = await request(buildTestApp()).get('/protected').set('X-Device-Id', identifier);
    expect(res.status).toBe(401);
  });

  it('returns 401 when X-Device-Id is missing', async () => {
    const res = await request(buildTestApp()).get('/protected').set('X-Device-Key', SECRET);
    expect(res.status).toBe(401);
  });

  it('returns 401 for an unknown identifier', async () => {
    const res = await request(buildTestApp())
      .get('/protected')
      .set('X-Device-Id', 'no-such-device')
      .set('X-Device-Key', SECRET);
    expect(res.status).toBe(401);
  });

  it('returns 401 for a wrong key', async () => {
    const res = await request(buildTestApp())
      .get('/protected')
      .set('X-Device-Id', identifier)
      .set('X-Device-Key', 'wrong-secret');
    expect(res.status).toBe(401);
  });

  it('returns 403 for a disabled device', async () => {
    await prisma.device.update({ where: { identifier }, data: { enabled: false } });

    const res = await request(buildTestApp())
      .get('/protected')
      .set('X-Device-Id', identifier)
      .set('X-Device-Key', SECRET);

    expect(res.status).toBe(403);
  });

  it('attaches the authenticated device to the request and calls next() on success', async () => {
    const res = await request(buildTestApp())
      .get('/protected')
      .set('X-Device-Id', identifier)
      .set('X-Device-Key', SECRET);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.device.identifier).toBe(identifier);
    expect(res.body.device.credentialHash).toBeUndefined();
  });

  it('never passes the raw secret to a log call, on success or failure', async () => {
    // Checks call *arguments* — i.e. that the code never hands the secret
    // to the logger in the first place. The logger's own redact config is
    // a separate safety net, verified against real output in logger.test.ts.
    const warnSpy = vi.spyOn(logger, 'warn');
    const infoSpy = vi.spyOn(logger, 'info');
    const errorSpy = vi.spyOn(logger, 'error');

    await request(buildTestApp())
      .get('/protected')
      .set('X-Device-Id', identifier)
      .set('X-Device-Key', 'wrong-secret');

    await request(buildTestApp())
      .get('/protected')
      .set('X-Device-Id', identifier)
      .set('X-Device-Key', SECRET);

    const allLoggedArgs = [...warnSpy.mock.calls, ...infoSpy.mock.calls, ...errorSpy.mock.calls]
      .flat()
      .map((arg) => JSON.stringify(arg));

    expect(allLoggedArgs.some((line) => line.includes(SECRET))).toBe(false);
    expect(allLoggedArgs.some((line) => line.includes('wrong-secret'))).toBe(false);

    warnSpy.mockRestore();
    infoSpy.mockRestore();
    errorSpy.mockRestore();
  });
});
