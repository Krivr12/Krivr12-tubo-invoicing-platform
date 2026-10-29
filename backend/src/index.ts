import express from 'express';
import { env, envFile } from './config/env.js';

// The /health route is added in Step 10.
const app = express();

app.listen(env.PORT, () => {
  const supabaseHost = new URL(env.SUPABASE_URL).host;
  console.log(
    `Tubo backend listening on port ${env.PORT} ` +
      `(NODE_ENV=${env.NODE_ENV}, env file=${envFile ?? 'none'}, supabase=${supabaseHost})`,
  );
});
