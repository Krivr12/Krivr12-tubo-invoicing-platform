# Technology Stack

Only the decisions confirmed in `milestones.md` (Section 1 and Section 2) belong here. Anything still marked **[CONFIRM]** or open is listed at the end, and must not be assumed.

## Stack

| Layer | Choice |
|---|---|
| Language | TypeScript, strict mode, in both frontend and backend |
| Backend | Node.js with Express |
| Database | Supabase Postgres |
| Authentication | Supabase Auth, email and password only (no OAuth) |
| Frontend | React with Vite (SPA), Tailwind CSS, shadcn/ui, latest stable versions |
| Frontend libraries | React Router, TanStack Query, react-hook-form with Zod |
| Package manager | npm, with the lockfile committed |
| Hosting | Vercel, Hobby plan, for every app (frontend, API, mock government API) |
| Scheduling | Vercel Cron only (defined in `vercel.json`) |

## Rules

- **Scheduling and deployment (D14):** Vercel is the only scheduler and the only host. Supabase provides Postgres and Auth. Do not use `pg_cron`, Supabase scheduled functions, Supabase Edge Functions, or any Supabase deployment.
- **Queue (D13):** a database-table queue in Postgres. Work is claimed with `FOR UPDATE SKIP LOCKED` on the `invoices` table (`status`, `attempt_count`, `next_retry_at`, `locked_until`). Do not use pg-boss or any other long-running worker library.
- **Background work (D11):** after the API responds, processing starts with `waitUntil` from `@vercel/functions`. A daily Vercel Cron job is the safety net.
- **Money:** `numeric(14,2)` in the database. Never use floating-point types for money.
- **Environments (D2, Environments section of README):** `dev` branch uses the `tubo-dev` Supabase project. `main` uses `tubo-prod`. Each has its own keys and database.
- **Backend data access (D3):** the backend uses the Supabase service-role key. Company scoping is enforced in code. RLS is enabled as a backup layer.
- **Government API (D12):** the URL comes from `GOVERNMENT_API_BASE_URL`. A mock service ships in `backend/` and is deployed as its own Vercel project (D4, D11).
- **Config and validation:** all environment variables are validated with Zod at startup. The app refuses to start on invalid config.
- **JSON casing (D6):** database columns are `snake_case`. API JSON is `camelCase`. The repository layer maps between them.
- **Join codes:** stored only as a slow hash (bcrypt or a similar slow hash). The plain code is shown once and never stored.

## Open items (not decided, do not assume)

- Role permissions for `admin` and `member` (M1).
- How the first admin of a company is created (M1).
- Whether the path is versioned as `/api/v1/` (M3).
- Whether the mock government API uses the same Supabase project as its environment (M4).
- Whether the mock is deployed alongside prod so prod invoices can reach `SUBMITTED` (D12).
- Which Supabase connection string (pooled or direct) suits serverless functions (M0 Vercel check).
