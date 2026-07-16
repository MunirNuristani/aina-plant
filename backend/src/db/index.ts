import { config } from '../config';
import { prisma } from './prisma';
import { logger } from '../lib/logger';
import type { PrismaClient } from '../generated/prisma/client';

export { prisma } from './prisma';

function maskConnectionString(connectionString: string): string {
  try {
    const url = new URL(connectionString);
    if (url.password) {
      url.password = '****';
    }
    return url.toString();
  } catch {
    return connectionString;
  }
}

function describeError(error: unknown): string {
  if (error instanceof AggregateError) {
    return error.errors.map(describeError).join('; ');
  }

  if (error instanceof Error) {
    const cleaned = error.message
      .replace(/Invalid `prisma\.\$queryRaw\(\)` invocation:/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (cleaned) {
      return cleaned;
    }

    const code = (error as { code?: string }).code;
    return code ?? error.name;
  }

  return String(error);
}

// Read-only, side-effect-free — safe to call from both the startup check
// and a per-request health check.
function pingDatabase(client: PrismaClient): Promise<unknown> {
  return client.$queryRaw`SELECT 1`;
}

export async function verifyDatabaseConnection(): Promise<void> {
  try {
    await pingDatabase(prisma);
  } catch (error) {
    const reason = describeError(error);

    logger.fatal(
      { databaseUrl: maskConnectionString(config.DATABASE_URL), reason },
      'Failed to connect to the database. Is PostgreSQL running? ' +
        'Start it with `docker compose up -d` from the backend/ directory, ' +
        'and see backend/README.md for troubleshooting.',
    );

    process.exit(1);
  }
}

/**
 * Per-request health check: never throws, never exits — returns a plain
 * boolean so callers (e.g. GET /health) can report status without leaking
 * connection details to the client. `client` is injectable so tests can
 * verify real failure handling against a genuinely unreachable database
 * without touching the shared app-wide connection.
 */
export async function isDatabaseHealthy(client: PrismaClient = prisma): Promise<boolean> {
  try {
    await pingDatabase(client);
    return true;
  } catch (error) {
    logger.error({ reason: describeError(error) }, 'Database health check failed');
    return false;
  }
}
