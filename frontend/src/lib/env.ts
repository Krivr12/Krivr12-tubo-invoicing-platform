import { z } from 'zod'

const httpUrl = z.url({ protocol: /^https?$/ })

/**
 * Every environment variable the frontend reads. Vite only exposes names that start with VITE_,
 * and everything it exposes is public in the browser bundle. Never put a secret here.
 */
const envSchema = z.object({
  // Supabase project for this environment (tubo-dev or tubo-prod).
  VITE_SUPABASE_URL: httpUrl,
  // The anon key is public by design. Row Level Security protects the data.
  VITE_SUPABASE_ANON_KEY: z.string().trim().min(1),
  // Base URL of the Tubo API.
  VITE_API_BASE_URL: httpUrl,
})

export type Env = z.infer<typeof envSchema>

/** Throws with the variable names and reasons, never the values. */
function loadEnv(source: Record<string, unknown>): Readonly<Env> {
  // A service-role key in the browser bundle would expose full database access (D3).
  const forbidden = Object.keys(source).filter((name) => /service[_-]?role/i.test(name))
  if (forbidden.length > 0) {
    throw new Error(
      `Forbidden environment variable in the frontend: ${forbidden.join(', ')}. ` +
        'Remove it. Service-role keys belong to the backend only.',
    )
  }

  const result = envSchema.safeParse(source)
  if (!result.success) {
    const lines = result.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n')
    throw new Error(
      `Invalid environment configuration:\n${lines}\n` +
        'See frontend/.env.example for the required variables.',
    )
  }

  return Object.freeze(result.data)
}

/** Validated, typed, read-only configuration. Import this instead of reading import.meta.env. */
export const env = loadEnv(import.meta.env)
