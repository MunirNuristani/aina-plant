import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { errorHandler, notFoundHandler } from './error-handler';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  toFieldErrors,
  UnauthorizedError,
  ValidationError,
} from '../http/errors';
import { requestIdMiddleware } from './request-id';
import { logger } from '../lib/logger';

function buildTestApp() {
  const app = express();
  app.use(requestIdMiddleware);

  app.get('/validation', () => {
    throw new ValidationError('Invalid payload', [{ field: 'name', message: 'name is required' }]);
  });
  app.get('/not-found', () => {
    throw new NotFoundError('Widget not found');
  });
  app.get('/conflict', () => {
    throw new ConflictError('Already assigned', { currentOwnerId: 'abc-123' });
  });
  app.get('/unauthorized', () => {
    throw new UnauthorizedError('Invalid credentials');
  });
  app.get('/forbidden', () => {
    throw new ForbiddenError('Account disabled');
  });
  app.get('/unexpected', () => {
    throw new Error('something exploded deep in application code');
  });
  app.get('/unexpected-async', async () => {
    await Promise.resolve();
    throw new Error('async explosion');
  });

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

describe('error type hierarchy', () => {
  it('maps each error type to its documented status code and machine-readable code', () => {
    const cases: Array<[Error, number, string]> = [
      [new ValidationError('x'), 400, 'VALIDATION_ERROR'],
      [new UnauthorizedError('x'), 401, 'UNAUTHORIZED'],
      [new ForbiddenError('x'), 403, 'FORBIDDEN'],
      [new NotFoundError('x'), 404, 'NOT_FOUND'],
      [new ConflictError('x'), 409, 'CONFLICT'],
    ];

    for (const [error, statusCode, code] of cases) {
      expect((error as { statusCode: number }).statusCode).toBe(statusCode);
      expect((error as { code: string }).code).toBe(code);
    }
  });
});

describe('toFieldErrors', () => {
  it('maps path + message into a stable, minimal shape', () => {
    const result = toFieldErrors([
      { path: ['moisturePercent'], message: 'must be between 0 and 100' },
      { path: ['device', 'id'], message: 'must be a valid UUID' },
    ]);

    expect(result).toEqual([
      { field: 'moisturePercent', message: 'must be between 0 and 100' },
      { field: 'device.id', message: 'must be a valid UUID' },
    ]);
  });

  it('falls back to a placeholder field name for a root-level issue', () => {
    const result = toFieldErrors([{ path: [], message: 'payload must be an object' }]);
    expect(result).toEqual([{ field: '(root)', message: 'payload must be an object' }]);
  });
});

describe('errorHandler', () => {
  it('returns the standard structure for an expected (AppError) error', async () => {
    const res = await request(buildTestApp()).get('/validation');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid payload',
        requestId: res.headers['x-request-id'],
        details: [{ field: 'name', message: 'name is required' }],
      },
    });
  });

  it.each([
    ['/not-found', 404, 'NOT_FOUND'],
    ['/conflict', 409, 'CONFLICT'],
    ['/unauthorized', 401, 'UNAUTHORIZED'],
    ['/forbidden', 403, 'FORBIDDEN'],
  ])('maps %s to status %d with code %s', async (path, status, code) => {
    const res = await request(buildTestApp()).get(path);

    expect(res.status).toBe(status);
    expect(res.body.error.code).toBe(code);
    expect(res.body.error.requestId).toBe(res.headers['x-request-id']);
  });

  it('omits `details` entirely when the error has none', async () => {
    const res = await request(buildTestApp()).get('/not-found');
    expect(res.body.error.details).toBeUndefined();
    expect('details' in res.body.error).toBe(false);
  });

  it('includes `details` for an error that provides them (e.g. ConflictError)', async () => {
    const res = await request(buildTestApp()).get('/conflict');
    expect(res.body.error.details).toEqual({ currentOwnerId: 'abc-123' });
  });

  it('returns a safe, generic response for an unexpected error, synchronous or async', async () => {
    for (const path of ['/unexpected', '/unexpected-async']) {
      const res = await request(buildTestApp()).get(path);

      expect(res.status).toBe(500);
      expect(res.body).toEqual({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Internal server error',
          requestId: res.headers['x-request-id'],
        },
      });
    }
  });

  it('never exposes a stack trace to the client, for any error type', async () => {
    for (const path of ['/validation', '/not-found', '/conflict', '/unexpected']) {
      const res = await request(buildTestApp()).get(path);
      const body = JSON.stringify(res.body);

      expect(body).not.toMatch(/at .*\(.*:\d+:\d+\)/); // typical stack frame shape
      expect(body.toLowerCase()).not.toContain('.ts:');
      expect(body.toLowerCase()).not.toContain('.js:');
    }
  });

  it('never exposes the internal (non-AppError) error message to the client', async () => {
    const res = await request(buildTestApp()).get('/unexpected');
    expect(JSON.stringify(res.body)).not.toContain('something exploded');
  });

  it('logs the full internal error, including its stack trace, for an unexpected error', async () => {
    const errorSpy = vi.spyOn(logger, 'error');

    await request(buildTestApp()).get('/unexpected');

    expect(errorSpy).toHaveBeenCalledWith(
      expect.objectContaining({ err: expect.objectContaining({ stack: expect.any(String) }) }),
      'Unhandled error',
    );
    const [[loggedFields]] = errorSpy.mock.calls;
    expect((loggedFields as { err: Error }).err.message).toBe(
      'something exploded deep in application code',
    );

    errorSpy.mockRestore();
  });

  it('does not log expected (AppError) errors as unhandled errors', async () => {
    const errorSpy = vi.spyOn(logger, 'error');

    await request(buildTestApp()).get('/validation');

    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});

describe('notFoundHandler', () => {
  it('returns the standard structure for an unmatched route', async () => {
    const res = await request(buildTestApp()).get('/no-such-route');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      error: {
        code: 'NOT_FOUND',
        message: 'Not found',
        requestId: res.headers['x-request-id'],
      },
    });
  });
});
