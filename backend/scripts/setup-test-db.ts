/**
 * One-time (and re-runnable) setup for the isolated test database: creates
 * it on the same local Postgres instance dev already uses (see
 * docker-compose.yml), if it doesn't already exist, then applies every
 * migration to it. Run this once after `npm run db:up`, and again any
 * time a new migration is added -- `npm test` itself does NOT run this
 * automatically (same pattern as `db:up` already being a manual
 * prerequisite step, not something the test run does for you).
 *
 * Deliberately a plain script, not a vitest globalSetup: creating and
 * migrating a database is a slower, occasional, explicit action -- not
 * something that should silently happen (or silently be skipped) on
 * every single `npm test` invocation.
 */

import { execSync } from 'node:child_process';

const POSTGRES_CONTAINER = 'aina-plant-postgres';
const POSTGRES_USER = 'user';
const TEST_DB_NAME = 'aina_plant_test';
const TEST_DATABASE_URL = `postgres://user:password@localhost:5433/${TEST_DB_NAME}`;

function testDatabaseExists(): boolean {
  const output = execSync(
    `docker exec ${POSTGRES_CONTAINER} psql -U ${POSTGRES_USER} -d postgres -tAc ` +
      `"SELECT 1 FROM pg_database WHERE datname='${TEST_DB_NAME}'"`,
  )
    .toString()
    .trim();
  return output === '1';
}

function main(): void {
  console.log(`Checking for database "${TEST_DB_NAME}"...`);

  if (testDatabaseExists()) {
    console.log(`Database "${TEST_DB_NAME}" already exists.`);
  } else {
    console.log(`Creating database "${TEST_DB_NAME}"...`);
    execSync(
      `docker exec ${POSTGRES_CONTAINER} psql -U ${POSTGRES_USER} -d postgres -c "CREATE DATABASE ${TEST_DB_NAME}"`,
      { stdio: 'inherit' },
    );
  }

  console.log('Applying migrations to the test database...');
  execSync('npx prisma migrate deploy', {
    stdio: 'inherit',
    // Overrides whatever .env's DATABASE_URL is -- dotenv (loaded by
    // prisma.config.ts) never overwrites a variable that's already set in
    // the environment, so this is what actually points `migrate deploy`
    // at the test database instead of the dev one.
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
  });

  console.log(`\nTest database "${TEST_DB_NAME}" is ready.`);
}

main();
