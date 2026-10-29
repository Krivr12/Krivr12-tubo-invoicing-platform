import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { parseEnv, type Env } from './env-schema.js';

// backend/ root. Resolves the same way from src/config (tsx) and dist/config (compiled).
const BACKEND_ROOT = fileURLToPath(new URL('../../', import.meta.url));

/**
 * Loads `.env.<NODE_ENV>` if it exists. Variables already present in the process
 * environment always win over the file, so Vercel's own settings take precedence.
 * Returns the file name that was loaded, or null when none exists.
 */
function loadEnvFile(): string | null {
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  const fileName = `.env.${nodeEnv}`;
  const filePath = `${BACKEND_ROOT}${fileName}`;

  if (!existsSync(filePath)) {
    return null;
  }

  dotenv.config({ path: filePath, quiet: true });
  return fileName;
}

function loadEnv(): { env: Env; envFile: string | null } {
  const envFile = loadEnvFile();
  const result = parseEnv(process.env);

  if (!result.success) {
    const lines = result.problems.map((problem) => `  - ${problem}`).join('\n');
    const source = envFile ?? 'process environment (no .env file found)';
    console.error(
      `Invalid environment configuration (loaded from ${source}):\n${lines}\n` +
        'Refusing to start. See backend/.env.example for the required variables.',
    );
    process.exit(1);
  }

  return { env: Object.freeze(result.env), envFile };
}

const loaded = loadEnv();

/** Validated, typed, read-only configuration. Import this instead of reading process.env. */
export const env: Readonly<Env> = loaded.env;

/** Name of the `.env.*` file that was loaded, or null when the values came from the process environment only. */
export const envFile: string | null = loaded.envFile;
