# Security Rules

These rules come from `milestones.md` (Section 1, Section 2 D1 and D3, and Section 4) and the M2 tasks.

## Secrets

- Secrets live only in environment variables. They are never committed and never written in code or logs.
- Commit only `.env.example` files, with placeholder values. `.env*` (except `.env.example`) is in `.gitignore`.
- Production values live in Vercel's environment variable settings.
- Never commit a database password, JWT secret, service-role key, or `CRON_SECRET`.

## Keys

- **Service-role key:** backend only, and only on the API project in Vercel. Never in the frontend, and never in a `VITE_` variable.
- **Anon key:** used by the frontend. It is public, but it still belongs in the environment, not in code.
- Dev and prod use different keys, URLs, and databases.

## Tenant isolation (D3)

- `company_id` always comes from the verified JWT (through the loaded user profile). It never comes from the request body, the URL, or a query string.
- Every repository method takes `companyId` as a required parameter. No unscoped invoice query may exist.
- Requesting another company's invoice returns `404`, not `403`, so invoice IDs are not revealed.
- RLS is enabled on all tables with company-scoped policies as a backup layer.
- Tenant isolation is proven by tests (M2).

## Authentication

- Authentication uses Supabase Auth with email and password.
- The backend verifies the Supabase JWT on every protected request.
- The frontend attaches the token to API calls and sends the user to login on `401`.

## Join codes (D1)

- A join code is stored only as a slow hash (bcrypt or a similar slow hash).
- A join code expires 7 days after generation. An expired code gets the same generic error as a wrong code.
- Sign-up returns one generic error for an unknown company and for an invalid code, so company existence is not revealed.
- Join-code attempts are rate limited.
- Join-code rotation is a one-off script. It prints the new plain code once and stores only its hash and new expiry.

## HTTP hardening

- `helmet` is enabled on the API.
- CORS uses an allowlist. In production, the allowlist contains only the production frontend origin.
- Rate limiting applies to auth endpoints and write endpoints.
- A request body size limit is set.
- The cron endpoint requires a `CRON_SECRET` bearer token.

## Input and output

- Every request body, query, and path parameter is validated with Zod.
- Never return stack traces, database errors, or internal messages to clients. See `error-handling.md`.
- Database constraints are the last line of defense, not the only validation.

## Dependencies

- Run `npm audit` before a release. Address high and critical findings (M9).
