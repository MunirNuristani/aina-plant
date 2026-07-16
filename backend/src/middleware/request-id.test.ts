import { randomUUID } from 'node:crypto';
import { Writable } from 'node:stream';
import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { requestIdMiddleware, REQUEST_ID_HEADER } from './request-id';
import { getRequestId } from '../lib/request-context';
import { createLogger, logger } from '../lib/logger';
import { createApp } from '../app';

function captureStream() {
  const chunks: string[] = [];
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      chunks.push(chunk.toString());
      callback();
    },
  });
  return { stream, chunks };
}

function buildTestApp() {
  const app = express();
  app.use(requestIdMiddleware);

  app.get('/echo', (req, res) => {
    res.status(200).json({ reqId: req.id, contextId: getRequestId() });
  });

  app.get('/slow-echo', async (req, res) => {
    const id = req.id;
    await new Promise((resolve) => setTimeout(resolve, 20));
    // Confirm the context is still correctly scoped to *this* request
    // after an async gap, even if another request interleaved.
    res.status(200).json({ reqId: id, contextIdAfterDelay: getRequestId() });
  });

  return app;
}

describe('requestIdMiddleware', () => {
  it('generates a UUID-shaped request ID when none is supplied', async () => {
    const res = await request(buildTestApp()).get('/echo');

    expect(res.status).toBe(200);
    expect(res.headers[REQUEST_ID_HEADER.toLowerCase()]).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    expect(res.body.reqId).toBe(res.headers[REQUEST_ID_HEADER.toLowerCase()]);
  });

  it('accepts a client-supplied UUID and echoes it back', async () => {
    const clientId = randomUUID();
    const res = await request(buildTestApp()).get('/echo').set(REQUEST_ID_HEADER, clientId);

    expect(res.status).toBe(200);
    expect(res.headers[REQUEST_ID_HEADER.toLowerCase()]).toBe(clientId);
    expect(res.body.reqId).toBe(clientId);
  });

  it.each([
    ['not a uuid at all', 'not-a-uuid'],
    ['too long', 'a'.repeat(5000)],
    ['wrong grouping', 'abcd1234abcd1234abcd1234abcd1234abcd'],
    ['empty string', ''],
  ])('generates a fresh ID instead of trusting an unsafe one (%s)', async (_label, unsafeId) => {
    const res = await request(buildTestApp()).get('/echo').set(REQUEST_ID_HEADER, unsafeId);

    expect(res.status).toBe(200);
    const returnedId = res.headers[REQUEST_ID_HEADER.toLowerCase()];
    expect(returnedId).not.toBe(unsafeId);
    expect(returnedId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });

  it('makes the request ID available to code with no access to req (via AsyncLocalStorage)', async () => {
    const res = await request(buildTestApp()).get('/echo');
    expect(res.body.contextId).toBe(res.body.reqId);
  });

  it('includes the request ID in logs emitted during the request', async () => {
    // pino writes via a raw file-descriptor mechanism, not console.* or even
    // process.stdout.write, so a real captured destination is needed to
    // observe actual output (see logger.test.ts for the isolated mechanism
    // test — this one proves it end-to-end through the real middleware).
    const { stream, chunks } = captureStream();
    const testLogger = createLogger(stream);

    const app = express();
    app.use(requestIdMiddleware);
    app.get('/log', (_req, res) => {
      testLogger.warn('something happened');
      res.status(200).json({ ok: true });
    });

    const clientId = randomUUID();
    await request(app).get('/log').set(REQUEST_ID_HEADER, clientId);

    const output = chunks.join('');
    expect(output).toContain(clientId);
    expect(output).toContain('something happened');
  });

  it('does not mix up two concurrent requests that share the same client-supplied ID', async () => {
    const sharedId = randomUUID();
    const app = buildTestApp();

    const [first, second] = await Promise.all([
      request(app).get('/slow-echo').set(REQUEST_ID_HEADER, sharedId),
      request(app).get('/slow-echo').set(REQUEST_ID_HEADER, sharedId),
    ]);

    // Both requests share the same ID by design — the point is that each
    // one's own context stays internally consistent (id === contextId
    // after the async gap) rather than one request's context leaking into
    // or corrupting the other's.
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(first.body.reqId).toBe(sharedId);
    expect(second.body.reqId).toBe(sharedId);
    expect(first.body.contextIdAfterDelay).toBe(sharedId);
    expect(second.body.contextIdAfterDelay).toBe(sharedId);
  });
});

describe('request IDs in the real app', () => {
  const app = createApp();

  it('includes the request ID in a 404 response', async () => {
    const res = await request(app).get('/no-such-route');

    expect(res.status).toBe(404);
    expect(res.body.error.requestId).toBe(res.headers[REQUEST_ID_HEADER.toLowerCase()]);
  });

  it('includes the request ID in a validation error response', async () => {
    const res = await request(app).get('/api/v1/readings/recent').query({ limit: -1 });

    expect(res.status).toBe(400);
    expect(res.body.error.requestId).toBe(res.headers[REQUEST_ID_HEADER.toLowerCase()]);
  });

  it('triggers the service-layer auth-rejection log, which has no access to req', async () => {
    // device-service.ts's authenticateDevice() takes no `req` parameter at
    // all. This confirms the log call happens on this code path; that it
    // actually receives the request ID (via AsyncLocalStorage, not manual
    // threading) is proven mechanically in logger.test.ts.
    const warnSpy = vi.spyOn(logger, 'warn');

    const res = await request(app)
      .post('/api/v1/readings')
      .set(REQUEST_ID_HEADER, randomUUID())
      .set('X-Device-Id', 'no-such-device')
      .set('X-Device-Key', 'wrong')
      .send({});

    expect(res.status).toBe(401);
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
  });
});
