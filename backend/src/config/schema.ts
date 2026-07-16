import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),

  DATABASE_URL: z
    .string()
    .min(1, 'DATABASE_URL is required')
    .regex(
      /^[a-z][a-z0-9+.-]*:\/\//i,
      'DATABASE_URL must be a connection URL (e.g. postgres://...)',
    ),

  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters long'),

  AI_API_KEY: z.string().min(1, 'AI_API_KEY is required'),

  LOG_LEVEL: z
    .enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent'])
    .default('info'),
});

export type Env = z.infer<typeof envSchema>;
