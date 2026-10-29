import { z } from 'zod';

const httpUrl = z.url({ protocol: /^https?$/ });

/**
 * Every environment variable the backend reads.
 * Add a variable here in the same milestone that first uses it.
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),

  // Supabase project for this environment (tubo-dev or tubo-prod).
  SUPABASE_URL: httpUrl,
  // Backend only. Bypasses RLS, so it must never reach the frontend (D3).
  SUPABASE_SERVICE_ROLE_KEY: z.string().trim().min(1),

  // Base URL of the government invoicing API, or of the mock (D12).
  GOVERNMENT_API_BASE_URL: httpUrl,

  // Bearer token that protects the Vercel Cron endpoint. Vercel requires 16+ characters.
  CRON_SECRET: z.string().trim().min(16),
});

export type Env = z.infer<typeof envSchema>;

export type ParseEnvResult =
  | { success: true; env: Env }
  | { success: false; problems: string[] };

/**
 * Validates a set of environment variables.
 * Problems list the variable name and the reason only, never the value,
 * because the values include secrets.
 */
export function parseEnv(source: NodeJS.ProcessEnv): ParseEnvResult {
  const result = envSchema.safeParse(source);

  if (result.success) {
    return { success: true, env: result.data };
  }

  const problems = result.error.issues.map((issue) => {
    const name = issue.path.join('.') || '(root)';
    return `${name}: ${issue.message}`;
  });

  return { success: false, problems };
}
