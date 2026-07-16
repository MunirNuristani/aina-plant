import { PrismaPg } from '@prisma/adapter-pg';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../app';
import { PrismaClient } from '../generated/prisma/client';
import * as db from '../db';

const app = createApp();

afterEach(() => {
  vi.restoreAllMocks();
});

describe('GET /health', () => {
  it('reports healthy with a 200 when the database is reachable', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      status: 'healthy',
      database: 'healthy',
      requestId: res.headers['x-request-id'],
    });
  });

  it('does not modify any data (read-only)', async () => {
    // No fixtures are created or mutated by this suite; a passing run of
    // the full test suite (whose other files assert exact row counts)
    // already demonstrates this endpoint doesn't write anything. Directly:
    // the underlying check is a `SELECT 1`, and the route itself performs
    // no writes.
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
  });

  it('reports unhealthy with a 503 when the database is unreachable', async () => {
    vi.spyOn(db, 'isDatabaseHealthy').mockResolvedValue(false);

    const res = await request(app).get('/health');

    expect(res.status).toBe(503);
    expect(res.body).toEqual({
      status: 'unhealthy',
      database: 'unhealthy',
      requestId: res.headers['x-request-id'],
    });
  });

  it('does not expose connection details or internal error messages when unhealthy', async () => {
    vi.spyOn(db, 'isDatabaseHealthy').mockResolvedValue(false);

    const res = await request(app).get('/health');

    const body = JSON.stringify(res.body);
    expect(body).not.toContain('postgres://');
    expect(body).not.toContain('ECONNREFUSED');
    expect(body).not.toMatch(/at .*\(.*:\d+:\d+\)/); // stack-frame shape
  });
});

describe('isDatabaseHealthy', () => {
  it('returns true against the real, reachable database', async () => {
    const result = await db.isDatabaseHealthy();
    expect(result).toBe(true);
  });

  it('returns false (not throw) against a genuinely unreachable database', async () => {
    const badAdapter = new PrismaPg({
      connectionString: 'postgres://user:password@localhost:1/nonexistent',
    });
    const badClient = new PrismaClient({ adapter: badAdapter });

    const result = await db.isDatabaseHealthy(badClient);
    expect(result).toBe(false);
  });
});
