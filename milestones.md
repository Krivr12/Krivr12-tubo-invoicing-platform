# Tubo – Implementation Milestones

**Status:** DRAFT. Items marked **[CONFIRM]** are proposals that need your approval before work on that milestone starts. Nothing marked [CONFIRM] should be treated as decided.

**Source of requirements:** `app_guide.md`
**Priority order from the guide:** Correctness → Data Integrity → Backend Design → Reliability → Security → Maintainability → UI

---

## 1. Confirmed Decisions

| Area | Decision |
|---|---|
| Time budget | 2 days |
| Language | TypeScript (strict mode), frontend and backend |
| Backend | Node.js + Express |
| Queue (D13) | **Database-table queue** in Postgres (`invoices` status + `next_retry_at` + `locked_until`, claimed with `FOR UPDATE SKIP LOCKED`). pg-boss is dropped because there is no long-running worker on Vercel |
| Database | Supabase Postgres |
| Authentication | Supabase Auth, email and password only (no Google/OAuth) |
| Frontend | React (Vite SPA) + Tailwind CSS + shadcn/ui, latest stable versions |
| Responsiveness | Usable on mobile and desktop |
| Environments | `dev` and `prod`, each with its own separate Supabase cloud project and database |
| Repo layout | One Git repo, plain folders: `frontend/` and `backend/` |
| User to company (D1) | Sign-up form where the user joins an existing company by entering a **company identifier + reusable join code, with the code stored hashed (slow hash such as bcrypt)**, validated on the server |
| JSON casing (D6) | Database `snake_case`, API JSON `camelCase`, mapped in the repository layer |
| Frontend libraries (D7) | React Router, TanStack Query, react-hook-form + Zod |
| Package manager (D8) | npm, lockfile committed |
| Production deployment (D9) | Production **will be deployed** (not just documented); hosting provider still to be chosen (see D11) |
| Written answers (D10) | Inside `README.md` |
| Hosting (D11) | Everything on **Vercel**, Hobby plan. No long-running worker: processing is triggered **on demand** after the API responds, with a **daily safety-net cron** |
| Government API in prod (D12) | Prod reaches the government API through a configurable URL (`GOVERNMENT_API_BASE_URL`); only the mock exists for now |
| Join code expiry (D1) | Join codes expire **7 days** after generation |
| User roles | `profiles.role` with two values: `admin` and `member`; what each role may do is still to be defined (see M1) |
| Mock government API (D4) | Separate module in `backend/`; on Vercel it deploys as its own project with its own URL (D11) |
| Permanent rejection (D5) | 4 statuses (`PENDING`, `PROCESSING`, `SUBMITTED`, `FAILED`) plus a `failure_type` column (`RETRYABLE` or `PERMANENT`) |
| Git branching (D2) | `main` (production) + `dev` (integration) + short-lived `feature/*` branches |
| Backend data access (D3) | Service-role key on the backend with **explicit company scoping in code**; RLS enabled as a backup layer |
| IDE / docs | Kiro, using steering docs for naming and conventions |
| Engineering standards | Project structure, naming conventions, separation of concerns, error handling, input validation, reusable code, database design, security practices, Git usage (see Section 4) |

---

## 2. Decisions Log

| # | Decision | Why it matters | Proposal |
|---|---|---|---|
| D1 | How a user joins an existing company | Tenant isolation (E1, Q8) | ✅ **Confirmed:** company identifier + reusable join code, code stored with a slow hash, validated server-side. Codes expire after **7 days**. |
| D2 | Git branching model | Git usage and the dev/prod split | ✅ **Confirmed:** `main` + `dev` + `feature/*` |
| D3 | Backend data access pattern | Service-role key bypasses RLS, so scoping must be enforced in code | ✅ **Confirmed:** service-role key + explicit `company_id` scoping, RLS as backup |
| D4 | Where the mock government API lives | Folder structure and how it is run | ✅ **Confirmed:** separate module in `backend/`, deployed as its own Vercel project with its own URL (D11) |
| D5 | Representing permanent rejection (HTTP 400) | A rejected invoice should not be retried blindly | ✅ **Confirmed:** 4 statuses + `failure_type` (`RETRYABLE` or `PERMANENT`) |
| D6 | JSON casing | Consistency across API and frontend | ✅ **Confirmed:** DB `snake_case`, API `camelCase`, mapped in the repository layer |
| D7 | Frontend libraries | Form handling and data fetching | ✅ **Confirmed:** React Router, TanStack Query, react-hook-form + Zod |
| D8 | Package manager | Reproducible installs | ✅ **Confirmed:** npm |
| D9 | Production deployment | Adds hosting work to a 2-day budget | ✅ **Confirmed:** deploy prod (see M10) |
| D10 | Where written answers (C1 to N) live | Submission needs them somewhere reviewable | ✅ **Confirmed:** inside `README.md` |
| D11 | Hosting provider | One provider for everything was requested | ✅ **Confirmed:** Vercel Hobby, on-demand trigger + daily safety-net cron. Consequence: slow automatic retries (see M5 known limitation). |
| D13 | Queue mechanism on serverless | pg-boss was built around a long-lived process | ✅ **Confirmed:** database-table queue, pg-boss dropped |
| D12 | Which "government API" prod points at | No real government service exists for this assessment | ✅ **Confirmed:** configurable URL (`GOVERNMENT_API_BASE_URL`), mock only for now. **Still open:** whether the mock is deployed on the same provider so prod invoices can actually reach `SUBMITTED`. |

---

## 3. Time Plan (2 Days)

| Day | Milestones |
|---|---|
| **Day 1** | M0 Foundation, M1 Database, M2 Auth, M3 Invoice API, M4 Mock gov API |
| **Day 2** | M5 Async processing, M6 Failure handling and retry, M7 and M8 Frontend, M9 Hardening, M10 Production deployment, M11 Docs, M12 Interview prep |

**Cut-line rule:** if time runs short, drop work from the bottom up, in this order: UI polish → stretch items → frontend extras → extra tests. Never cut M1 (data integrity), M5 and M6 (reliability), or the Part I and J answers. Anything cut is listed under "Production Improvements" in the README.

---

## 4. Engineering Standards (Applies to Every Milestone)

| Standard | Rule |
|---|---|
| **Project structure** | Layered backend: `routes → controllers → services → repositories`. Feature folders on the frontend. See Section 5. |
| **Naming conventions** | Files `kebab-case`; types, classes, components `PascalCase`; variables, functions `camelCase`; constants `UPPER_SNAKE_CASE`; DB tables plural `snake_case`; DB columns `snake_case`; enums uppercase values. Documented in a Kiro steering doc. |
| **Separation of concerns** | Controllers only parse the request and return the response. Business rules live in services. SQL/DB access lives only in repositories. External HTTP calls live only in `integrations/`. |
| **Error handling** | Custom `AppError` classes with a stable `code`. One central error middleware. Consistent response shape `{ error: { code, message, details? } }`. Never leak stack traces or DB errors to clients. Every error logged with a request ID. |
| **Input validation** | Zod schemas at every boundary (request body, query, params, env vars). Database constraints are the last line of defense. |
| **Reusable code** | Shared helpers (money math, pagination, error classes, API client, form components, hooks). No copy-pasted logic. |
| **Database design** | Normalized tables, FKs, unique constraints, check constraints, indexes, `numeric` for money. Schema changes only through migration files. |
| **Security practices** | Secrets only in environment variables, never committed. Service-role key used on the backend only. `helmet`, CORS allowlist, rate limiting, JWT verification, tenant scoping on every query. |
| **Git usage** | Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`). Small, focused commits. Feature branches. `.gitignore` covers `.env*` (except `.env.example`). No secrets ever in history. |

---

## 5. Proposed Repository Structure [CONFIRM]

```
tubo/
├── .kiro/
│   └── steering/                # product.md, tech.md, structure.md,
│                                # naming-conventions.md, security.md,
│                                # error-handling.md, git-workflow.md
├── backend/
│   ├── src/
│   │   ├── config/              # env loading and validation
│   │   ├── routes/
│   │   ├── controllers/
│   │   ├── services/
│   │   ├── repositories/
│   │   ├── middleware/          # auth, error handler, request id, rate limit
│   │   ├── schemas/             # Zod schemas
│   │   ├── integrations/        # government API client
│   │   ├── jobs/                # processing service, claim logic, cron handler (per D13)
│   │   ├── mock-government-api/ # mock service (D4)
│   │   ├── lib/                 # logger, errors, money, pagination
│   │   └── types/
│   ├── tests/
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/ui/       # shadcn components
│   │   ├── features/            # auth, invoices (pages, hooks, components)
│   │   ├── lib/                 # api client, utils
│   │   └── routes/
│   ├── .env.example
│   └── package.json
├── supabase/
│   └── migrations/              # hand-written SQL migrations
├── docs/
│   ├── architecture.md          # diagram
│   └── api/                     # Postman collection
├── README.md
├── app_guide.md
└── milestones.md
```

---

## 6. Milestones

### M0 – Foundation and Environments
**Covers:** Part O, Part P (setup), Part E2
**Goal:** A clean, reproducible project skeleton with dev and prod fully separated.

- [x] Initialize Git repo; add `.gitignore`, first commit, and create `main` and `dev` branches; all work happens on `feature/*` branches merged into `dev`, and `dev` is merged into `main` for production releases
- [x] Map branches to environments: `dev` branch uses the dev Supabase project, `main` uses the prod project (document this in the README)
- [x] Create two Supabase cloud projects: `tubo-dev` and `tubo-prod`
- [x] Scaffold `backend/` (Express + TypeScript strict) and `frontend/` (Vite + React + TypeScript)
- [x] Install Tailwind and initialize shadcn/ui; verify latest stable versions at install time
- [x] Environment config: `.env.example` files committed; real `.env.*` files ignored; env vars validated with Zod at startup (app refuses to boot on invalid config)
- [x] Environment switching: `NODE_ENV` and scripts (`dev`, `build`, `start`) that load the correct Supabase project
- [x] Lint, format, and TypeScript config (ESLint, Prettier)
- [x] Write Kiro steering docs for naming, structure, security, error handling, and Git workflow
- [ ] **Verify the Vercel assumptions now, before building on them** and record the results under README assumptions: Express deploys as a Vercel function; `waitUntil` works and how it behaves on Hobby; the real function max duration for your plan; a daily cron deploys on Hobby; which Supabase connection string suits serverless functions

**Done when:** both apps start, a `/health` endpoint responds, and switching environments changes which Supabase project is used with no code edits.

**Confirm first:** the folder structure in Section 5, and the steering doc list in `.kiro/steering/`.

---

### M1 – Database Design and Migrations
**Covers:** Part B, Part C (C1, C2, C3), Part J, Part L (schema)
**Goal:** A schema that makes duplicates and cross-tenant access structurally difficult.

- [ ] Tables: `companies` (includes a unique, human-readable `slug` used as the company identifier at sign-up, a `join_code_hash` produced with a slow hash such as bcrypt, and a `join_code_expires_at` timestamp, per D1; the plain code is generated once, shown once, and never stored), `profiles` (links `auth.users` to a company, with a `role` column constrained to `admin` or `member`), `invoices`, `invoice_items`, `invoice_processing_logs` (one row per attempt)
- [ ] Primary keys: `uuid`; foreign keys with appropriate `ON DELETE` behavior
- [ ] **Unique constraint on `(company_id, invoice_number)`**, the core of C2, C3, and Part J
- [ ] Money columns as `numeric(14,2)`, never float; check constraints (quantity > 0, amounts >= 0)
- [ ] Status stored as a constrained enum/check: `PENDING`, `PROCESSING`, `SUBMITTED`, `FAILED`; plus a nullable `failure_type` (`RETRYABLE` or `PERMANENT`) that is only set when status is `FAILED` (enforced by a check constraint, per D5)
- [ ] Processing log columns: invoice FK, attempt number, started at, ended at, status, HTTP status code, error message, response body excerpt
- [ ] Queue columns on `invoices` (per D13): `attempt_count`, `next_retry_at`, `locked_until`, with an index on `(status, next_retry_at)`
- [ ] Indexes: `(company_id, status)`, `(company_id, invoice_date)`, `(invoice_id, attempt_number)`
- [ ] `created_at` / `updated_at` with an update trigger
- [ ] Enable RLS on all tables with company-scoped policies (defense in depth)
- [ ] Seed script for dev: sample companies and demo data
- [ ] Apply migrations to dev; apply to prod only after dev verification

**Done when:** inserting a duplicate `(company_id, invoice_number)` fails at the database level, and migrations run cleanly on a fresh project.

**Confirm first:** what each role may do (for example, who can retry an invoice, create invoices, or rotate the join code), and how the first admin of a company is created.

---

### M2 – Authentication and Tenant Isolation
**Covers:** Part E (E1, E2, E3)
**Goal:** Every request is authenticated, and every query is company-scoped.

- [ ] Sign-up and sign-in via Supabase Auth (email/password)
- [ ] Company join flow (per D1): sign-up submits email, password, a company identifier (`slug`), and a join code; the server looks up the company by identifier, verifies the code against the stored hash, and creates the `profiles` row linking the user to that company; an unknown company or invalid code rejects the sign-up with the same generic error so company existence is not leaked
- [ ] Rate limit join-code attempts to prevent guessing
- [ ] Reject expired join codes with the same generic error as a wrong code
- [ ] One-off script to rotate a company's join code: generates a new code, stores its hash and a new expiry (7 days), and prints the plain code once
- [ ] Auth middleware: verify the Supabase JWT, load the user's `company_id`, attach to the request context
- [ ] **`company_id` always comes from the verified user, never from the request body or URL**
- [ ] Repository methods require `companyId` as a parameter; no unscoped invoice queries exist
- [ ] Return `404` (not `403`) for another company's invoice, so IDs are not leaked
- [ ] Security middleware: `helmet`, CORS allowlist, rate limiting on auth and write endpoints, request size limit
- [ ] Draft answers to E1, E2, E3

**Done when:** a test proves User A requesting Company B's invoice ID receives `404`.

**Confirm first:** role permissions for `admin` and `member` (see M1); once defined, they are enforced in the service layer and covered by tests. Note that because the backend uses the service-role key (D3), tenant isolation depends on every repository query taking `companyId`, so this must be covered by tests.

---

### M3 – Invoice API (Create, List, Get)
**Covers:** Part D (1 to 3), Part C (C2, C3), Part J
**Goal:** Correct, validated, duplicate-safe invoice intake.

- [ ] `POST /api/v1/invoices`
  - Zod validation of header and items
  - Server recomputes line totals, subtotal, tax, total (money helper) and rejects mismatching client totals
  - Insert header + items in a **single transaction**
  - Duplicate handled by catching the unique-violation error, returning `409` with a clear code (never check-then-insert, see Part J)
  - Create the invoice as `PENDING`, enqueue the job, return `202 Accepted` (accepted, not yet submitted, see H2)
- [ ] `GET /api/v1/invoices` with filters (status, invoice date range, invoice number) and pagination
- [ ] `GET /api/v1/invoices/:id` returning header, items, and processing attempts
- [ ] Consistent error responses and correct HTTP codes (`400`, `401`, `404`, `409`, `422`, `500`)
- [ ] Draft answers to Part J (all six questions)

**Done when:** two simultaneous identical POSTs result in exactly one invoice and one `409`.

**Confirm first:** whether to version the path as `/api/v1/` (the guide shows `/api/invoices` in Part D and `/api/v1/invoices` in Part M).

---

### M4 – Mock Government API
**Covers:** Part G
**Goal:** A controllable fake external service for testing every failure mode.

- [ ] `POST /government-api/invoices` mock, per D4
- [ ] Behaviors: `200` success, `503` temporary failure, `400` invalid invoice, timeout (no response)
- [ ] Controllable via config or a header/env flag for deterministic tests, plus random mode for demo
- [ ] **Honors an `Idempotency-Key` header**: the same key submitted twice returns the original result and does not create a second record
- [ ] Records received submissions in a **database table** (serverless functions keep no memory between requests) with a unique constraint on the idempotency key, so duplicates can be proven absent [CONFIRM: same Supabase project per environment]

**Done when:** each of the four outcomes can be triggered on demand.

**Confirm first:** whether the mock stores its records in the same Supabase project as the environment it serves (see the task above).

---

### M5 – Asynchronous Processing (on Vercel)
**Covers:** Part H (H1, H2, H3), Part K (K2, K3), Part N
**Goal:** The API accepts quickly and processing continues in the background, within Vercel's serverless limits (D11).

**Confirmed trigger strategy:** Vercel Hobby plan, **on-demand trigger + daily safety-net cron**.

- [ ] Queue state lives in the `invoices` table: `status`, `attempt_count`, `next_retry_at`, `locked_until` (columns added in M1)
- [ ] On create: store the invoice as `PENDING`, return `202 Accepted`, then start processing with `waitUntil` (from `@vercel/functions`) so the work continues after the response is sent
- [ ] Atomic claim in one SQL statement or Postgres function using `FOR UPDATE SKIP LOCKED`, setting `PROCESSING` and `locked_until`, so two triggers can never process the same invoice
- [ ] One processing service used by **both** the on-demand trigger and the cron endpoint: claim → create a processing log row → call the government client → record the outcome
- [ ] Government client in `integrations/`: request **timeout set well below Vercel's function max duration** (value verified in M0), error classification, `Idempotency-Key` = invoice ID, base URL from `GOVERNMENT_API_BASE_URL` validated at startup (D12)
- [ ] Outcome handling: `200` → `SUBMITTED`; `503` or timeout → `FAILED` with `failure_type = RETRYABLE` and a `next_retry_at` from a backoff schedule; `400` → `FAILED` with `failure_type = PERMANENT` (never retried)
- [ ] Limited immediate retries inside the on-demand invocation (a few attempts, seconds apart, within the time budget); anything beyond that waits for the cron or a manual retry
- [ ] Safety-net cron endpoint (for example `/api/cron/process-invoices`) scheduled **daily** in `vercel.json`, protected by a `CRON_SECRET` bearer check; processes a bounded batch of due invoices: `PENDING`, retryable `FAILED` with `next_retry_at <= now`, and `PROCESSING` with an expired `locked_until`
- [ ] Batch size and per-invocation concurrency caps, configurable (protects the government API, relates to K2)
- [ ] Draft answers to H1 to H3, K2, K3, N

**Known limitation of the Hobby plan [CONFIRM]:** Vercel's docs say Hobby cron runs at most once per day, and Hobby cron timing is not guaranteed to the minute. An invoice that fails its on-demand attempts can therefore wait up to roughly a day for its next automatic retry. A manual Retry (M6) is immediate. The H3 answer ("government API down for 30 minutes") must describe the production design (a frequent scheduler or a proper queue service) and state plainly what this assessment implements.

**Done when:** creating an invoice returns immediately, the invoice reaches `SUBMITTED` without manual action when the mock succeeds, and a forced failure is picked up when the cron endpoint is triggered manually.

---

### M6 – Failure Handling, Retry, and Crash Recovery
**Covers:** Part I (I1, I2, I3), Part L (L1, L2), Part D (4)
**Goal:** No lost invoices and no duplicate submissions, even when a function is cut off mid-job.

- [ ] Every attempt is a **new** `invoice_processing_logs` row; previous errors are never overwritten (L1)
- [ ] `POST /api/v1/invoices/:id/retry`: allowed only for `FAILED` invoices whose `failure_type` is `RETRYABLE`; returns `409` otherwise (including `PERMANENT` failures); sets `next_retry_at` to now and triggers processing on demand with `waitUntil`
- [ ] **Crash scenario (Part I) on Vercel:** the function is cut off or times out after the government API replied with success but before the database update. The invoice is left in `PROCESSING` with an expired `locked_until`; the cron endpoint (or a manual retry) reclaims it
- [ ] The stale-lock threshold must be **longer than the maximum function duration**, otherwise a healthy job could be reclaimed while it is still running
- [ ] On recovery, resubmission reuses the same `Idempotency-Key`, so the government service returns the original result instead of creating a duplicate (I2, I3)
- [ ] Simulate the crash: a dev-only flag makes the processing service throw right after the government API replies success; capture the result as evidence
- [ ] Support-engineer investigation path documented (L2): attempts queryable by invoice, status, and date range
- [ ] Draft answers to I1 to I3, L1, L2

**Done when:** the crash simulation ends with the invoice `SUBMITTED` and exactly one record in the mock government service.

---

### M7 – Frontend Foundation and Auth Screens
**Covers:** Part F (foundation), Part E
**Goal:** A responsive shell with working login and sign-up.

- [ ] App layout: mobile-first, navigation that works on small screens, touch-friendly targets
- [ ] Routing with protected routes
- [ ] Sign-up (with company join per D1), sign-in, sign-out
- [ ] API client wrapper: attaches the token, normalizes errors, handles `401` by redirecting to login
- [ ] Reusable UI pieces: loading, empty, and error states; status badge component

**Done when:** a user can sign up, sign in, and reach a protected page on both a phone-sized and desktop-sized viewport.

---

### M8 – Frontend Invoice Features
**Covers:** Part F
**Goal:** Dashboard, create, and details screens.

- [ ] **Dashboard:** invoice number, customer, date, amount, status; filters and pagination. Table on desktop, card list on mobile.
- [ ] **Create Invoice:** header fields, add and remove multiple items, live totals preview, client validation, server validation errors mapped to fields
- [ ] **Invoice Details:** header, items, status, processing attempts and error info; **Retry** button shown only for retryable `FAILED` invoices
- [ ] Status refresh (polling or manual refresh; choose the simplest) so users see `PROCESSING → SUBMITTED`

**Done when:** the full user journey works end to end on mobile and desktop: create → watch status → view details → retry a failed invoice.

---

### M9 – Hardening and Testing
**Covers:** Part O, Part E, Part J, Part I
**Goal:** Prove the critical guarantees.

- [ ] Automated tests for: duplicate and concurrent create, tenant isolation, total calculation, retry eligibility, status transitions
- [ ] Failure-mode tests against the mock: `503`, `400`, timeout, and the crash scenario
- [ ] Review error handling consistency and that no secrets or stack traces leak
- [ ] Dependency audit (`npm audit`) and a final secrets scan of the Git history
- [ ] Confirm dev and prod are separate (different keys, URLs, and databases) and prod has no test data

**Done when:** the critical-guarantee tests pass and can be run with a single command.

---

### M10 – Production Deployment (Vercel)
**Covers:** Part Q (Q10), Part P (Production Improvements), environment separation
**Goal:** A running production environment, fully separate from dev.

- [ ] Apply migrations to `tubo-prod` (only after they are verified on `tubo-dev`)
- [ ] Three Vercel projects: frontend, API (Express), and the mock government API
- [ ] Environment mapping: `main` deploys to Vercel **Production** using the prod Supabase project; `dev` and feature branches deploy as **Preview** using the dev Supabase project (verify how env vars are scoped on the Hobby plan)
- [ ] Environment variables set in Vercel's settings, never in Git: Supabase keys (the service-role key only on the API project), `CRON_SECRET`, and `GOVERNMENT_API_BASE_URL` pointing at the deployed mock (D12)
- [ ] Daily cron declared in the API project's `vercel.json` and confirmed to deploy on Hobby
- [ ] Production CORS allowlist limited to the prod frontend origin
- [ ] Create prod companies and join codes with a one-off script; **no dev seed data in prod**
- [ ] Smoke test in prod: sign up with a company identifier and join code, create an invoice, watch it reach `SUBMITTED`, trigger a retry on a failed one
- [ ] Deploys are safe mid-flight because processing is idempotent and recoverable (feeds the Q10 answer)
- [ ] Release flow documented: feature → `dev` → verify → `main` → production deploy

**Done when:** the prod URL works end to end using only the prod database, and no dev credentials exist in the prod environment.

**Time risk:** three Vercel projects plus cron plus two Supabase environments is the most likely thing to overrun a 2-day budget. Do a throwaway deploy of the API and mock early, right after the M0 checks.

**Confirm first:** whether the mock is deployed alongside prod so invoices can reach `SUBMITTED` (D12), and whether a documented but not-yet-live deployment is an acceptable fallback if time runs out.

---

### M11 – Documentation and Submission
**Covers:** Part P, Submission Requirements
**Goal:** A reviewer can run and understand everything without asking you.

- [ ] `README.md`: setup (frontend, backend, database, both environments), architecture, assumptions, production improvements, and the **written answers** to C1 to C3, E1 to E3, H1 to H3, I1 to I3, J, K1 to K3, L1 to L2, M, N (per D10)
- [ ] Part M (API versioning) and Part K (scalability) written as design answers
- [ ] Architecture diagram: components, processing flow, and the crash/recovery flow
- [ ] Postman collection or API docs
- [ ] Final clean-install test from a fresh clone
- [ ] Submission: Git repo link, schema/migrations, README, API docs, diagram

---

### M12 – Technical Discussion Preparation
**Covers:** Part Q, "Use of AI Tools"
**Goal:** Be able to explain, modify, and debug every part live.

- [ ] Prepare answers to the 10 Part Q questions, using your real implementation as evidence
- [ ] Identify the weakest part of your implementation honestly, plus what you would do with two more days
- [ ] Walk through each major file and explain it in 30 seconds
- [ ] Practice small live changes (add a field, change a retry setting, add a filter)
- [ ] Be ready to say which parts were AI-assisted and how you verified them

---

## 7. Final Checklist Against the Guide

- [ ] Create, list, get, and retry endpoints work
- [ ] Duplicates impossible (database constraint) under concurrency
- [ ] Tenant isolation proven by a test
- [ ] API returns `202` and processes asynchronously
- [ ] Every attempt logged; nothing overwritten
- [ ] Crash scenario produces no duplicate submission
- [ ] Frontend: dashboard, create form (add/remove items, validation errors), details with retry
- [ ] Usable on mobile and desktop
- [ ] Separate dev and prod environments and databases
- [ ] No secrets in Git
- [ ] README, migrations, API docs, diagram, written answers included
