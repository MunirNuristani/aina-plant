import 'dotenv/config';
import { envSchema, type Env } from './schema';

function loadConfig(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const issues = result.error.issues.map(
      (issue) => `  - ${issue.path.join('.')}: ${issue.message}`,
    );

    console.error('Invalid environment configuration:');
    console.error(issues.join('\n'));
    console.error('\nCheck your .env file against .env.example.');

    process.exit(1);
  }

  return result.data;
}

export const config = loadConfig();
