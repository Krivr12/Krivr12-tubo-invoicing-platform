import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(4000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  // No default on purpose: the process must not start with a guessable secret.
  JWT_SECRET: z.string().min(32, 'JWT_SECRET is required and must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().min(1).default('1d'),

  // Worker and retry settings. All have defaults, so an existing .env keeps working.
  MAX_RETRY_ATTEMPTS: z.coerce.number().int().positive().default(8),
  RETRY_BASE_DELAY_SECONDS: z.coerce.number().positive().default(60),
  RETRY_MAX_DELAY_SECONDS: z.coerce.number().positive().default(900),
  WORKER_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(1000),
  WORKER_BATCH_SIZE: z.coerce.number().int().positive().default(5),
  // The lock must outlast the government call, or another worker could claim a live attempt.
  WORKER_LOCK_SECONDS: z.coerce.number().positive().default(60),
  GOVERNMENT_API_TIMEOUT_MS: z.coerce.number().int().positive().default(10000),
}).refine((env) => env.WORKER_LOCK_SECONDS * 1000 > env.GOVERNMENT_API_TIMEOUT_MS, {
  path: ['WORKER_LOCK_SECONDS'],
  message: 'WORKER_LOCK_SECONDS must be longer than GOVERNMENT_API_TIMEOUT_MS',
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // Print only the variable names and messages, never the values.
  console.error('Invalid environment configuration:');
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
  }
  process.exit(1);
}

export const ENV = parsed.data;
