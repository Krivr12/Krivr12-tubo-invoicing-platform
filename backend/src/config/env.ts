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
