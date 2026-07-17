import { config as loadDotenv } from 'dotenv';
import { envSchema, type Env } from './schema';

// Tests load .env.test instead of .env -- a separate, isolated database
// (and other config) so `npm test` never reads from or writes to the same
// database a developer is using for manual/local testing. See
// .env.test's own comment and README.md's "isolated test database"
// section. NODE_ENV=test is set explicitly by the `test`/`test:watch` npm
// scripts, not left to vitest's own default, so this is never ambiguous.
const envFile = process.env.NODE_ENV === 'test' ? '.env.test' : '.env';
loadDotenv({ path: envFile });

function loadConfig(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const issues = result.error.issues.map(
      (issue) => `  - ${issue.path.join('.')}: ${issue.message}`,
    );

    console.error('Invalid environment configuration:');
    console.error(issues.join('\n'));
    console.error(`\nCheck your ${envFile} file against .env.example.`);

    process.exit(1);
  }

  return result.data;
}

export const config = loadConfig();
