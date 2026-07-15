import { config } from '../config';
import { prisma } from './prisma';

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

export async function verifyDatabaseConnection(): Promise<void> {
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (error) {
    const reason = describeError(error);

    console.error('Failed to connect to the database:');
    console.error(`  DATABASE_URL: ${maskConnectionString(config.DATABASE_URL)}`);
    console.error(`  Reason: ${reason}`);
    console.error(
      '\nIs PostgreSQL running? Start it with `docker compose up -d` from the backend/ directory,' +
        ' and see backend/README.md for troubleshooting.',
    );

    process.exit(1);
  }
}
